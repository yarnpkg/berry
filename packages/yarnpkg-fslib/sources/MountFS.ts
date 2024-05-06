import {BigIntStats, constants, Stats}                                                                                                               from 'fs';

import {WatchOptions, WatchCallback, Watcher, StatOptions, StatSyncOptions, ReaddirOptions, DirentNoPath, RmOptions}                                 from './FakeFS';
import {FakeFS, MkdirOptions, RmdirOptions, WriteFileOptions, OpendirOptions}                                                                        from './FakeFS';
import {Dirent, SymlinkType}                                                                                                                         from './FakeFS';
import {CreateReadStreamOptions, CreateWriteStreamOptions, BasePortableFakeFS, ExtractHintOptions, WatchFileOptions, WatchFileCallback, StatWatcher} from './FakeFS';
import {NodeFS}                                                                                                                                      from './NodeFS';
import {watchFile, unwatchFile, unwatchAllFiles}                                                                                                     from './algorithms/watchFile';
import * as errors                                                                                                                                   from './errors';
import {Filename, FSPath, npath, PortablePath}                                                                                                       from './path';

// Only file descriptors prefixed by those values will be forwarded to the MountFS
// instances. Note that the highest MOUNT_MAGIC bit MUST NOT be set, otherwise the
// resulting fd becomes a negative integer, which isn't supposed to happen per
// the unix rules (caused problems w/ Go).
//
// Those values must be synced with packages/yarnpkg-pnp/sources/esm-loader/fspatch.ts
//
const MOUNT_MASK  = 0xff000000;

export type GetMountPointFn = (path: PortablePath, prefixPath: PortablePath) => PortablePath | null;

export interface MountableFS extends FakeFS<PortablePath> {
  hasOpenFileHandles?(): boolean;
  saveAndClose?(): void;
  discardAndClose?(): void;
}

export type MountFSOptions<MountedFS extends MountableFS> = {
  baseFs?: FakeFS<PortablePath>;
  filter?: RegExp | null;
  magicByte?: number;
  maxOpenFiles?: number;
  typeCheck?: number | null;
  useCache?: boolean;

  /**
   * Functions used to create the sub-filesystem to use when accessing specific paths.
   */
  factorySync: (baseFs: FakeFS<PortablePath>, path: PortablePath) => MountedFS;
  factoryPromise: (baseFs: FakeFS<PortablePath>, path: PortablePath) => Promise<() => MountedFS>;

  /**
   * A function that will be called to figure out the segment of a path that represents a mount point.
   *
   * It must return a strict prefix of the original path, or `null` if the path isn't part of a mount archive.
   */
  getMountPoint: GetMountPointFn;

  /**
   * Maximum age of the child filesystem, after which they will be discarded. Each new access resets this time.
   *
   * Only used if `useCache` is set to `true`.
   */
  maxAge?: number;
};

export class MountFS<MountedFS extends MountableFS> extends BasePortableFakeFS {
  private readonly baseFs: FakeFS<PortablePath>;

  private readonly mountInstances: Map<string, {
    childFs: MountedFS;
    expiresAt: number;
    refCount: number;
  }> | null;

  private readonly fdMap: Map<number, [MountedFS, number]> = new Map();
  private nextFd = 3;

  private readonly factoryPromise: MountFSOptions<MountedFS>[`factoryPromise`];
  private readonly factorySync: MountFSOptions<MountedFS>[`factorySync`];
  private readonly filter: RegExp | null;
  private readonly getMountPoint: GetMountPointFn;
  private readonly magic: number;
  private readonly maxAge: number;
  private readonly maxOpenFiles: number;
  private readonly typeCheck: number | null;

  private isMount: Set<PortablePath> = new Set();
  private notMount: Set<PortablePath> = new Set();
  private realPaths: Map<PortablePath, PortablePath> = new Map();

  constructor({baseFs = new NodeFS(), filter = null, magicByte = 0x2a, maxOpenFiles = Infinity, useCache = true, maxAge = 5000, typeCheck = constants.S_IFREG, getMountPoint, factoryPromise, factorySync}: MountFSOptions<MountedFS>) {
    if (Math.floor(magicByte) !== magicByte || !(magicByte > 1 && magicByte <= 127))
      throw new Error(`The magic byte must be set to a round value between 1 and 127 included`);

    super();

    this.baseFs = baseFs;

    this.mountInstances = useCache ? new Map() : null;

    this.factoryPromise = factoryPromise;
    this.factorySync = factorySync;
    this.filter = filter;
    this.getMountPoint = getMountPoint;
    this.magic = magicByte << 24;
    this.maxAge = maxAge;
    this.maxOpenFiles = maxOpenFiles;
    this.typeCheck = typeCheck;
  }

  getExtractHint(hints: ExtractHintOptions) {
    return this.baseFs.getExtractHint(hints);
  }

  getRealPath() {
    return this.baseFs.getRealPath();
  }

  saveAndClose() {
    unwatchAllFiles(this);

    if (this.mountInstances) {
      for (const [path, {childFs}] of this.mountInstances.entries()) {
        childFs.saveAndClose?.();
        this.mountInstances.delete(path);
      }
    }
  }

  discardAndClose() {
    unwatchAllFiles(this);

    if (this.mountInstances) {
      for (const [path, {childFs}] of this.mountInstances.entries()) {
        childFs.discardAndClose?.();
        this.mountInstances.delete(path);
      }
    }
  }

  resolve(p: PortablePath) {
    return this.baseFs.resolve(p);
  }

  private remapFd(mountFs: MountedFS, fd: number) {
    const remappedFd = this.nextFd++ | this.magic;
    this.fdMap.set(remappedFd, [mountFs, fd]);
    return remappedFd;
  }

  async openPromise(p: PortablePath, flags: string, mode?: number) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.openPromise(p, flags, mode);
    }, async (mountFs, {subPath}) => {
      return this.remapFd(mountFs, await mountFs.openPromise(subPath, flags, mode));
    });
  }

  openSync(p: PortablePath, flags: string, mode?: number) {
    return this.makeCallSync(p, () => {
      return this.baseFs.openSync(p, flags, mode);
    }, (mountFs, {subPath}) => {
      return this.remapFd(mountFs, mountFs.openSync(subPath, flags, mode));
    });
  }

  async opendirPromise(p: PortablePath, opts?: OpendirOptions) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.opendirPromise(p, opts);
    }, async (mountFs, {subPath}) => {
      return await mountFs.opendirPromise(subPath, opts);
    }, {
      requireSubpath: false,
    });
  }

  opendirSync(p: PortablePath, opts?: OpendirOptions) {
    return this.makeCallSync(p, () => {
      return this.baseFs.opendirSync(p, opts);
    }, (mountFs, {subPath}) => {
      return mountFs.opendirSync(subPath, opts);
    }, {
      requireSubpath: false,
    });
  }

  async readPromise(fd: number, buffer: Buffer, offset: number, length: number, position: number) {
    if ((fd & MOUNT_MASK) !== this.magic)
      return await this.baseFs.readPromise(fd, buffer, offset, length, position);

    const entry = this.fdMap.get(fd);
    if (typeof entry === `undefined`)
      throw errors.EBADF(`read`);

    const [mountFs, realFd] = entry;
    return await mountFs.readPromise(realFd, buffer, offset, length, position);
  }

  readSync(fd: number, buffer: Buffer, offset: number, length: number, position: number) {
    if ((fd & MOUNT_MASK) !== this.magic)
      return this.baseFs.readSync(fd, buffer, offset, length, position);

    const entry = this.fdMap.get(fd);
    if (typeof entry === `undefined`)
      throw errors.EBADF(`readSync`);

    const [mountFs, realFd] = entry;
    return mountFs.readSync(realFd, buffer, offset, length, position);
  }

  writePromise(fd: number, buffer: Buffer, offset?: number, length?: number, position?: number): Promise<number>;
  writePromise(fd: number, buffer: string, position?: number): Promise<number>;
  async writePromise(fd: number, buffer: Buffer | string, offset?: number, length?: number, position?: number): Promise<number> {
    if ((fd & MOUNT_MASK) !== this.magic) {
      if (typeof buffer === `string`) {
        return await this.baseFs.writePromise(fd, buffer, offset);
      } else {
        return await this.baseFs.writePromise(fd, buffer, offset, length, position);
      }
    }

    const entry = this.fdMap.get(fd);
    if (typeof entry === `undefined`)
      throw errors.EBADF(`write`);

    const [mountFs, realFd] = entry;

    if (typeof buffer === `string`) {
      return await mountFs.writePromise(realFd, buffer, offset);
    } else {
      return await mountFs.writePromise(realFd, buffer, offset, length, position);
    }
  }

  writeSync(fd: number, buffer: Buffer, offset?: number, length?: number, position?: number): number;
  writeSync(fd: number, buffer: string, position?: number): number;
  writeSync(fd: number, buffer: Buffer | string, offset?: number, length?: number, position?: number): number {
    if ((fd & MOUNT_MASK) !== this.magic) {
      if (typeof buffer === `string`) {
        return this.baseFs.writeSync(fd, buffer, offset);
      } else {
        return this.baseFs.writeSync(fd, buffer, offset, length, position);
      }
    }

    const entry = this.fdMap.get(fd);
    if (typeof entry === `undefined`)
      throw errors.EBADF(`writeSync`);

    const [mountFs, realFd] = entry;

    if (typeof buffer === `string`) {
      return mountFs.writeSync(realFd, buffer, offset);
    } else {
      return mountFs.writeSync(realFd, buffer, offset, length, position);
    }
  }

  async closePromise(fd: number) {
    if ((fd & MOUNT_MASK) !== this.magic)
      return await this.baseFs.closePromise(fd);

    const entry = this.fdMap.get(fd);
    if (typeof entry === `undefined`)
      throw errors.EBADF(`close`);

    this.fdMap.delete(fd);

    const [mountFs, realFd] = entry;
    return await mountFs.closePromise(realFd);
  }

  closeSync(fd: number) {
    if ((fd & MOUNT_MASK) !== this.magic)
      return this.baseFs.closeSync(fd);

    const entry = this.fdMap.get(fd);
    if (typeof entry === `undefined`)
      throw errors.EBADF(`closeSync`);

    this.fdMap.delete(fd);

    const [mountFs, realFd] = entry;
    return mountFs.closeSync(realFd);
  }

  createReadStream(p: PortablePath | null, opts?: CreateReadStreamOptions) {
    if (p === null)
      return this.baseFs.createReadStream(p, opts);

    return this.makeCallSync(p, () => {
      return this.baseFs.createReadStream(p, opts);
    }, (mountFs, {archivePath, subPath}) => {
      const stream = mountFs.createReadStream(subPath, opts);
      // This is a very hacky workaround. `MountOpenFS` shouldn't have to work with `NativePath`s.
      // Ref: https://github.com/yarnpkg/berry/pull/3774
      // TODO: think of a better solution
      stream.path = npath.fromPortablePath(this.pathUtils.join(archivePath, subPath));
      return stream;
    });
  }

  createWriteStream(p: PortablePath | null, opts?: CreateWriteStreamOptions) {
    if (p === null)
      return this.baseFs.createWriteStream(p, opts);

    return this.makeCallSync(p, () => {
      return this.baseFs.createWriteStream(p, opts);
    }, (mountFs, {subPath}) => {
      return mountFs.createWriteStream(subPath, opts);
    });
  }

  async realpathPromise(p: PortablePath) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.realpathPromise(p);
    }, async (mountFs, {archivePath, subPath}) => {
      let realArchivePath = this.realPaths.get(archivePath);
      if (typeof realArchivePath === `undefined`) {
        realArchivePath = await this.baseFs.realpathPromise(archivePath);
        this.realPaths.set(archivePath, realArchivePath);
      }

      return this.pathUtils.join(realArchivePath, this.pathUtils.relative(PortablePath.root, await mountFs.realpathPromise(subPath)));
    });
  }

  realpathSync(p: PortablePath) {
    return this.makeCallSync(p, () => {
      return this.baseFs.realpathSync(p);
    }, (mountFs, {archivePath, subPath}) => {
      let realArchivePath = this.realPaths.get(archivePath);
      if (typeof realArchivePath === `undefined`) {
        realArchivePath = this.baseFs.realpathSync(archivePath);
        this.realPaths.set(archivePath, realArchivePath);
      }

      return this.pathUtils.join(realArchivePath, this.pathUtils.relative(PortablePath.root, mountFs.realpathSync(subPath)));
    });
  }

  async existsPromise(p: PortablePath) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.existsPromise(p);
    }, async (mountFs, {subPath}) => {
      return await mountFs.existsPromise(subPath);
    });
  }

  existsSync(p: PortablePath) {
    return this.makeCallSync(p, () => {
      return this.baseFs.existsSync(p);
    }, (mountFs, {subPath}) => {
      return mountFs.existsSync(subPath);
    });
  }

  async accessPromise(p: PortablePath, mode?: number) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.accessPromise(p, mode);
    }, async (mountFs, {subPath}) => {
      return await mountFs.accessPromise(subPath, mode);
    });
  }

  accessSync(p: PortablePath, mode?: number) {
    return this.makeCallSync(p, () => {
      return this.baseFs.accessSync(p, mode);
    }, (mountFs, {subPath}) => {
      return mountFs.accessSync(subPath, mode);
    });
  }

  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/51d793492d4c2e372b01257668dcd3afc58d7352/types/node/v16/fs.d.ts#L1042-L1059
  async statPromise(p: PortablePath): Promise<Stats>;
  async statPromise(p: PortablePath, opts: (StatOptions & { bigint?: false | undefined }) | undefined): Promise<Stats>;
  async statPromise(p: PortablePath, opts: StatOptions & { bigint: true }): Promise<BigIntStats>;
  async statPromise(p: PortablePath, opts?: StatOptions): Promise<Stats | BigIntStats>;
  async statPromise(p: PortablePath, opts?: StatOptions): Promise<Stats | BigIntStats> {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.statPromise(p, opts);
    }, async (mountFs, {subPath}) => {
      return await mountFs.statPromise(subPath, opts);
    });
  }

  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/51d793492d4c2e372b01257668dcd3afc58d7352/types/node/v16/fs.d.ts#L931-L967
  statSync(p: PortablePath): Stats;
  statSync(p: PortablePath, opts?: StatSyncOptions & {bigint?: false | undefined, throwIfNoEntry: false}): Stats | undefined;
  statSync(p: PortablePath, opts: StatSyncOptions & {bigint: true, throwIfNoEntry: false}): BigIntStats | undefined;
  statSync(p: PortablePath, opts?: StatSyncOptions & {bigint?: false | undefined}): Stats;
  statSync(p: PortablePath, opts: StatSyncOptions & {bigint: true}): BigIntStats;
  statSync(p: PortablePath, opts: StatSyncOptions & {bigint: boolean, throwIfNoEntry?: false | undefined}): Stats | BigIntStats;
  statSync(p: PortablePath, opts?: StatSyncOptions): Stats | BigIntStats | undefined {
    return this.makeCallSync(p, () => {
      return this.baseFs.statSync(p, opts);
    }, (mountFs, {subPath}) => {
      return mountFs.statSync(subPath, opts);
    });
  }

  async fstatPromise(fd: number): Promise<Stats>;
  async fstatPromise(fd: number, opts: {bigint: true}): Promise<BigIntStats>;
  async fstatPromise(fd: number, opts?: {bigint: boolean}): Promise<BigIntStats | Stats>;
  async fstatPromise(fd: number, opts?: { bigint: boolean }) {
    if ((fd & MOUNT_MASK) !== this.magic)
      return this.baseFs.fstatPromise(fd, opts);

    const entry = this.fdMap.get(fd);
    if (typeof entry === `undefined`)
      throw errors.EBADF(`fstat`);

    const [mountFs, realFd] = entry;
    return mountFs.fstatPromise(realFd, opts);
  }

  fstatSync(fd: number): Stats;
  fstatSync(fd: number, opts: {bigint: true}): BigIntStats;
  fstatSync(fd: number, opts?: {bigint: boolean}): BigIntStats | Stats;
  fstatSync(fd: number, opts?: { bigint: boolean }) {
    if ((fd & MOUNT_MASK) !== this.magic)
      return this.baseFs.fstatSync(fd, opts);

    const entry = this.fdMap.get(fd);
    if (typeof entry === `undefined`)
      throw errors.EBADF(`fstatSync`);

    const [mountFs, realFd] = entry;
    return mountFs.fstatSync(realFd, opts);
  }

  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/51d793492d4c2e372b01257668dcd3afc58d7352/types/node/v16/fs.d.ts#L1042-L1059
  async lstatPromise(p: PortablePath): Promise<Stats>;
  async lstatPromise(p: PortablePath, opts: (StatOptions & { bigint?: false | undefined }) | undefined): Promise<Stats>;
  async lstatPromise(p: PortablePath, opts: StatOptions & { bigint: true }): Promise<BigIntStats>;
  async lstatPromise(p: PortablePath, opts?: StatOptions): Promise<Stats | BigIntStats> {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.lstatPromise(p, opts);
    }, async (mountFs, {subPath}) => {
      return await mountFs.lstatPromise(subPath, opts);
    });
  }

  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/51d793492d4c2e372b01257668dcd3afc58d7352/types/node/v16/fs.d.ts#L931-L967
  lstatSync(p: PortablePath): Stats;
  lstatSync(p: PortablePath, opts?: StatSyncOptions & {bigint?: false | undefined, throwIfNoEntry: false}): Stats | undefined;
  lstatSync(p: PortablePath, opts: StatSyncOptions & {bigint: true, throwIfNoEntry: false}): BigIntStats | undefined;
  lstatSync(p: PortablePath, opts?: StatSyncOptions & {bigint?: false | undefined}): Stats;
  lstatSync(p: PortablePath, opts: StatSyncOptions & {bigint: true}): BigIntStats;
  lstatSync(p: PortablePath, opts: StatSyncOptions & { bigint: boolean, throwIfNoEntry?: false | undefined }): Stats | BigIntStats;
  lstatSync(p: PortablePath, opts?: StatSyncOptions): Stats | BigIntStats | undefined {
    return this.makeCallSync(p, () => {
      return this.baseFs.lstatSync(p, opts);
    }, (mountFs, {subPath}) => {
      return mountFs.lstatSync(subPath, opts);
    });
  }

  async fchmodPromise(fd: number, mask: number): Promise<void> {
    if ((fd & MOUNT_MASK) !== this.magic)
      return this.baseFs.fchmodPromise(fd, mask);

    const entry = this.fdMap.get(fd);
    if (typeof entry === `undefined`)
      throw errors.EBADF(`fchmod`);

    const [mountFs, realFd] = entry;
    return mountFs.fchmodPromise(realFd, mask);
  }

  fchmodSync(fd: number, mask: number): void {
    if ((fd & MOUNT_MASK) !== this.magic)
      return this.baseFs.fchmodSync(fd, mask);

    const entry = this.fdMap.get(fd);
    if (typeof entry === `undefined`)
      throw errors.EBADF(`fchmodSync`);

    const [mountFs, realFd] = entry;
    return mountFs.fchmodSync(realFd, mask);
  }

  async chmodPromise(p: PortablePath, mask: number) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.chmodPromise(p, mask);
    }, async (mountFs, {subPath}) => {
      return await mountFs.chmodPromise(subPath, mask);
    });
  }

  chmodSync(p: PortablePath, mask: number) {
    return this.makeCallSync(p, () => {
      return this.baseFs.chmodSync(p, mask);
    }, (mountFs, {subPath}) => {
      return mountFs.chmodSync(subPath, mask);
    });
  }

  async fchownPromise(fd: number, uid: number, gid: number): Promise<void> {
    if ((fd & MOUNT_MASK) !== this.magic)
      return this.baseFs.fchownPromise(fd, uid, gid);

    const entry = this.fdMap.get(fd);
    if (typeof entry === `undefined`)
      throw errors.EBADF(`fchown`);

    const [zipFs, realFd] = entry;
    return zipFs.fchownPromise(realFd, uid, gid);
  }

  fchownSync(fd: number, uid: number, gid: number): void {
    if ((fd & MOUNT_MASK) !== this.magic)
      return this.baseFs.fchownSync(fd, uid, gid);

    const entry = this.fdMap.get(fd);
    if (typeof entry === `undefined`)
      throw errors.EBADF(`fchownSync`);

    const [zipFs, realFd] = entry;
    return zipFs.fchownSync(realFd, uid, gid);
  }

  async chownPromise(p: PortablePath, uid: number, gid: number) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.chownPromise(p, uid, gid);
    }, async (mountFs, {subPath}) => {
      return await mountFs.chownPromise(subPath, uid, gid);
    });
  }

  chownSync(p: PortablePath, uid: number, gid: number) {
    return this.makeCallSync(p, () => {
      return this.baseFs.chownSync(p, uid, gid);
    }, (mountFs, {subPath}) => {
      return mountFs.chownSync(subPath, uid, gid);
    });
  }

  async renamePromise(oldP: PortablePath, newP: PortablePath) {
    return await this.makeCallPromise(oldP, async () => {
      return await this.makeCallPromise(newP, async () => {
        return await this.baseFs.renamePromise(oldP, newP);
      }, async () => {
        throw Object.assign(new Error(`EEXDEV: cross-device link not permitted`), {code: `EEXDEV`});
      });
    }, async (mountFsO, {subPath: subPathO}) => {
      return await this.makeCallPromise(newP, async () => {
        throw Object.assign(new Error(`EEXDEV: cross-device link not permitted`), {code: `EEXDEV`});
      }, async (mountFsN, {subPath: subPathN}) => {
        if (mountFsO !== mountFsN) {
          throw Object.assign(new Error(`EEXDEV: cross-device link not permitted`), {code: `EEXDEV`});
        } else {
          return await mountFsO.renamePromise(subPathO, subPathN);
        }
      });
    });
  }

  renameSync(oldP: PortablePath, newP: PortablePath) {
    return this.makeCallSync(oldP, () => {
      return this.makeCallSync(newP, () => {
        return this.baseFs.renameSync(oldP, newP);
      }, () => {
        throw Object.assign(new Error(`EEXDEV: cross-device link not permitted`), {code: `EEXDEV`});
      });
    }, (mountFsO, {subPath: subPathO}) => {
      return this.makeCallSync(newP, () => {
        throw Object.assign(new Error(`EEXDEV: cross-device link not permitted`), {code: `EEXDEV`});
      }, (mountFsN, {subPath: subPathN}) => {
        if (mountFsO !== mountFsN) {
          throw Object.assign(new Error(`EEXDEV: cross-device link not permitted`), {code: `EEXDEV`});
        } else {
          return mountFsO.renameSync(subPathO, subPathN);
        }
      });
    });
  }

  async copyFilePromise(sourceP: PortablePath, destP: PortablePath, flags: number = 0) {
    const fallback = async (sourceFs: FakeFS<PortablePath>, sourceP: PortablePath, destFs: FakeFS<PortablePath>, destP: PortablePath) => {
      if ((flags & constants.COPYFILE_FICLONE_FORCE) !== 0)
        throw Object.assign(new Error(`EXDEV: cross-device clone not permitted, copyfile '${sourceP}' -> ${destP}'`), {code: `EXDEV`});
      if ((flags & constants.COPYFILE_EXCL) && await this.existsPromise(sourceP))
        throw Object.assign(new Error(`EEXIST: file already exists, copyfile '${sourceP}' -> '${destP}'`), {code: `EEXIST`});

      let content;
      try {
        content = await sourceFs.readFilePromise(sourceP);
      } catch (error) {
        throw Object.assign(new Error(`EINVAL: invalid argument, copyfile '${sourceP}' -> '${destP}'`), {code: `EINVAL`});
      }

      await destFs.writeFilePromise(destP, content);
    };

    return await this.makeCallPromise(sourceP, async () => {
      return await this.makeCallPromise(destP, async () => {
        return await this.baseFs.copyFilePromise(sourceP, destP, flags);
      }, async (mountFsD, {subPath: subPathD}) => {
        return await fallback(this.baseFs, sourceP, mountFsD, subPathD);
      });
    }, async (mountFsS, {subPath: subPathS}) => {
      return await this.makeCallPromise(destP, async () => {
        return await fallback(mountFsS, subPathS, this.baseFs, destP);
      }, async (mountFsD, {subPath: subPathD}) => {
        if (mountFsS !== mountFsD) {
          return await fallback(mountFsS, subPathS, mountFsD, subPathD);
        } else {
          return await mountFsS.copyFilePromise(subPathS, subPathD, flags);
        }
      });
    });
  }

  copyFileSync(sourceP: PortablePath, destP: PortablePath, flags: number = 0) {
    const fallback = (sourceFs: FakeFS<PortablePath>, sourceP: PortablePath, destFs: FakeFS<PortablePath>, destP: PortablePath) => {
      if ((flags & constants.COPYFILE_FICLONE_FORCE) !== 0)
        throw Object.assign(new Error(`EXDEV: cross-device clone not permitted, copyfile '${sourceP}' -> ${destP}'`), {code: `EXDEV`});
      if ((flags & constants.COPYFILE_EXCL) && this.existsSync(sourceP))
        throw Object.assign(new Error(`EEXIST: file already exists, copyfile '${sourceP}' -> '${destP}'`), {code: `EEXIST`});

      let content;
      try {
        content = sourceFs.readFileSync(sourceP);
      } catch (error) {
        throw Object.assign(new Error(`EINVAL: invalid argument, copyfile '${sourceP}' -> '${destP}'`), {code: `EINVAL`});
      }

      destFs.writeFileSync(destP, content);
    };

    return this.makeCallSync(sourceP, () => {
      return this.makeCallSync(destP, () => {
        return this.baseFs.copyFileSync(sourceP, destP, flags);
      }, (mountFsD, {subPath: subPathD}) => {
        return fallback(this.baseFs, sourceP, mountFsD, subPathD);
      });
    }, (mountFsS, {subPath: subPathS}) => {
      return this.makeCallSync(destP, () => {
        return fallback(mountFsS, subPathS, this.baseFs, destP);
      }, (mountFsD, {subPath: subPathD}) => {
        if (mountFsS !== mountFsD) {
          return fallback(mountFsS, subPathS, mountFsD, subPathD);
        } else {
          return mountFsS.copyFileSync(subPathS, subPathD, flags);
        }
      });
    });
  }

  async appendFilePromise(p: FSPath<PortablePath>, content: string | Uint8Array, opts?: WriteFileOptions) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.appendFilePromise(p, content, opts);
    }, async (mountFs, {subPath}) => {
      return await mountFs.appendFilePromise(subPath, content, opts);
    });
  }

  appendFileSync(p: FSPath<PortablePath>, content: string | Uint8Array, opts?: WriteFileOptions) {
    return this.makeCallSync(p, () => {
      return this.baseFs.appendFileSync(p, content, opts);
    }, (mountFs, {subPath}) => {
      return mountFs.appendFileSync(subPath, content, opts);
    });
  }

  async writeFilePromise(p: FSPath<PortablePath>, content: string | NodeJS.ArrayBufferView, opts?: WriteFileOptions) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.writeFilePromise(p, content, opts);
    }, async (mountFs, {subPath}) => {
      return await mountFs.writeFilePromise(subPath, content, opts);
    });
  }

  writeFileSync(p: FSPath<PortablePath>, content: string | NodeJS.ArrayBufferView, opts?: WriteFileOptions) {
    return this.makeCallSync(p, () => {
      return this.baseFs.writeFileSync(p, content, opts);
    }, (mountFs, {subPath}) => {
      return mountFs.writeFileSync(subPath, content, opts);
    });
  }

  async unlinkPromise(p: PortablePath) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.unlinkPromise(p);
    }, async (mountFs, {subPath}) => {
      return await mountFs.unlinkPromise(subPath);
    });
  }

  unlinkSync(p: PortablePath) {
    return this.makeCallSync(p, () => {
      return this.baseFs.unlinkSync(p);
    }, (mountFs, {subPath}) => {
      return mountFs.unlinkSync(subPath);
    });
  }

  async utimesPromise(p: PortablePath, atime: Date | string | number, mtime: Date | string | number) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.utimesPromise(p, atime, mtime);
    }, async (mountFs, {subPath}) => {
      return await mountFs.utimesPromise(subPath, atime, mtime);
    });
  }

  utimesSync(p: PortablePath, atime: Date | string | number, mtime: Date | string | number) {
    return this.makeCallSync(p, () => {
      return this.baseFs.utimesSync(p, atime, mtime);
    }, (mountFs, {subPath}) => {
      return mountFs.utimesSync(subPath, atime, mtime);
    });
  }

  async lutimesPromise(p: PortablePath, atime: Date | string | number, mtime: Date | string | number) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.lutimesPromise(p, atime, mtime);
    }, async (mountFs, {subPath}) => {
      return await mountFs.lutimesPromise(subPath, atime, mtime);
    });
  }

  lutimesSync(p: PortablePath, atime: Date | string | number, mtime: Date | string | number) {
    return this.makeCallSync(p, () => {
      return this.baseFs.lutimesSync(p, atime, mtime);
    }, (mountFs, {subPath}) => {
      return mountFs.lutimesSync(subPath, atime, mtime);
    });
  }

  async mkdirPromise(p: PortablePath, opts?: MkdirOptions) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.mkdirPromise(p, opts);
    }, async (mountFs, {subPath}) => {
      return await mountFs.mkdirPromise(subPath, opts);
    });
  }

  mkdirSync(p: PortablePath, opts?: MkdirOptions) {
    return this.makeCallSync(p, () => {
      return this.baseFs.mkdirSync(p, opts);
    }, (mountFs, {subPath}) => {
      return mountFs.mkdirSync(subPath, opts);
    });
  }

  async rmdirPromise(p: PortablePath, opts?: RmdirOptions) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.rmdirPromise(p, opts);
    }, async (mountFs, {subPath}) => {
      return await mountFs.rmdirPromise(subPath, opts);
    });
  }

  rmdirSync(p: PortablePath, opts?: RmdirOptions) {
    return this.makeCallSync(p, () => {
      return this.baseFs.rmdirSync(p, opts);
    }, (mountFs, {subPath}) => {
      return mountFs.rmdirSync(subPath, opts);
    });
  }


  async rmPromise(p: PortablePath, opts?: RmOptions) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.rmPromise(p, opts);
    }, async (mountFs, {subPath}) => {
      return await mountFs.rmPromise(subPath, opts);
    });
  }

  rmSync(p: PortablePath, opts?: RmOptions) {
    return this.makeCallSync(p, () => {
      return this.baseFs.rmSync(p, opts);
    }, (mountFs, {subPath}) => {
      return mountFs.rmSync(subPath, opts);
    });
  }
  async linkPromise(existingP: PortablePath, newP: PortablePath) {
    return await this.makeCallPromise(newP, async () => {
      return await this.baseFs.linkPromise(existingP, newP);
    }, async (mountFs, {subPath}) => {
      return await mountFs.linkPromise(existingP, subPath);
    });
  }

  linkSync(existingP: PortablePath, newP: PortablePath) {
    return this.makeCallSync(newP, () => {
      return this.baseFs.linkSync(existingP, newP);
    }, (mountFs, {subPath}) => {
      return mountFs.linkSync(existingP, subPath);
    });
  }

  async symlinkPromise(target: PortablePath, p: PortablePath, type?: SymlinkType) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.symlinkPromise(target, p, type);
    }, async (mountFs, {subPath}) => {
      return await mountFs.symlinkPromise(target, subPath);
    });
  }

  symlinkSync(target: PortablePath, p: PortablePath, type?: SymlinkType) {
    return this.makeCallSync(p, () => {
      return this.baseFs.symlinkSync(target, p, type);
    }, (mountFs, {subPath}) => {
      return mountFs.symlinkSync(target, subPath);
    });
  }

  readFilePromise(p: FSPath<PortablePath>, encoding?: null): Promise<Buffer>;
  readFilePromise(p: FSPath<PortablePath>, encoding: BufferEncoding): Promise<string>;
  readFilePromise(p: FSPath<PortablePath>, encoding?: BufferEncoding | null): Promise<Buffer | string>;
  async readFilePromise(p: FSPath<PortablePath>, encoding?: BufferEncoding | null) {
    return this.makeCallPromise(p, async () => {
      return await this.baseFs.readFilePromise(p, encoding);
    }, async (mountFs, {subPath}) => {
      return await mountFs.readFilePromise(subPath, encoding);
    });
  }

  readFileSync(p: FSPath<PortablePath>, encoding?: null): Buffer;
  readFileSync(p: FSPath<PortablePath>, encoding: BufferEncoding): string;
  readFileSync(p: FSPath<PortablePath>, encoding?: BufferEncoding | null): Buffer | string;
  readFileSync(p: FSPath<PortablePath>, encoding?: BufferEncoding | null) {
    return this.makeCallSync(p, () => {
      return this.baseFs.readFileSync(p, encoding);
    }, (mountFs, {subPath}) => {
      return mountFs.readFileSync(subPath, encoding);
    });
  }

  async readdirPromise(p: PortablePath, opts?: null): Promise<Array<Filename>>;
  async readdirPromise(p: PortablePath, opts: {recursive?: false, withFileTypes: true}): Promise<Array<DirentNoPath>>;
  async readdirPromise(p: PortablePath, opts: {recursive?: false, withFileTypes?: false}): Promise<Array<Filename>>;
  async readdirPromise(p: PortablePath, opts: {recursive?: false, withFileTypes: boolean}): Promise<Array<DirentNoPath | Filename>>;
  async readdirPromise(p: PortablePath, opts: {recursive: true, withFileTypes: true}): Promise<Array<Dirent<PortablePath>>>;
  async readdirPromise(p: PortablePath, opts: {recursive: true, withFileTypes?: false}): Promise<Array<PortablePath>>;
  async readdirPromise(p: PortablePath, opts: {recursive: true, withFileTypes: boolean}): Promise<Array<Dirent<PortablePath> | PortablePath>>;
  async readdirPromise(p: PortablePath, opts: {recursive: boolean, withFileTypes: true}): Promise<Array<Dirent<PortablePath> | DirentNoPath>>;
  async readdirPromise(p: PortablePath, opts: {recursive: boolean, withFileTypes?: false}): Promise<Array<PortablePath>>;
  async readdirPromise(p: PortablePath, opts: {recursive: boolean, withFileTypes: boolean}): Promise<Array<Dirent<PortablePath> | DirentNoPath | PortablePath>>;
  async readdirPromise(p: PortablePath, opts?: ReaddirOptions | null): Promise<Array<Dirent<PortablePath> | DirentNoPath | PortablePath>> {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.readdirPromise(p, opts as any);
    }, async (mountFs, {subPath}) => {
      return await mountFs.readdirPromise(subPath, opts as any);
    }, {
      requireSubpath: false,
    });
  }

  readdirSync(p: PortablePath, opts?: null): Array<Filename>;
  readdirSync(p: PortablePath, opts: {recursive?: false, withFileTypes: true}): Array<DirentNoPath>;
  readdirSync(p: PortablePath, opts: {recursive?: false, withFileTypes?: false}): Array<Filename>;
  readdirSync(p: PortablePath, opts: {recursive?: false, withFileTypes: boolean}): Array<DirentNoPath | Filename>;
  readdirSync(p: PortablePath, opts: {recursive: true, withFileTypes: true}): Array<Dirent<PortablePath>>;
  readdirSync(p: PortablePath, opts: {recursive: true, withFileTypes?: false}): Array<PortablePath>;
  readdirSync(p: PortablePath, opts: {recursive: true, withFileTypes: boolean}): Array<Dirent<PortablePath> | PortablePath>;
  readdirSync(p: PortablePath, opts: {recursive: boolean, withFileTypes: true}): Array<Dirent<PortablePath> | DirentNoPath>;
  readdirSync(p: PortablePath, opts: {recursive: boolean, withFileTypes?: false}): Array<PortablePath>;
  readdirSync(p: PortablePath, opts: {recursive: boolean, withFileTypes: boolean}): Array<Dirent<PortablePath> | DirentNoPath | PortablePath>;
  readdirSync(p: PortablePath, opts?: ReaddirOptions | null): Array<Dirent<PortablePath> | DirentNoPath | PortablePath> {
    return this.makeCallSync(p, () => {
      return this.baseFs.readdirSync(p, opts as any);
    }, (mountFs, {subPath}) => {
      return mountFs.readdirSync(subPath, opts as any);
    }, {
      requireSubpath: false,
    });
  }

  async readlinkPromise(p: PortablePath) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.readlinkPromise(p);
    }, async (mountFs, {subPath}) => {
      return await mountFs.readlinkPromise(subPath);
    });
  }

  readlinkSync(p: PortablePath) {
    return this.makeCallSync(p, () => {
      return this.baseFs.readlinkSync(p);
    }, (mountFs, {subPath}) => {
      return mountFs.readlinkSync(subPath);
    });
  }

  async truncatePromise(p: PortablePath, len?: number) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.truncatePromise(p, len);
    }, async (mountFs, {subPath}) => {
      return await mountFs.truncatePromise(subPath, len);
    });
  }

  truncateSync(p: PortablePath, len?: number) {
    return this.makeCallSync(p, () => {
      return this.baseFs.truncateSync(p, len);
    }, (mountFs, {subPath}) => {
      return mountFs.truncateSync(subPath, len);
    });
  }

  async ftruncatePromise(fd: number, len?: number): Promise<void> {
    if ((fd & MOUNT_MASK) !== this.magic)
      return this.baseFs.ftruncatePromise(fd, len);

    const entry = this.fdMap.get(fd);
    if (typeof entry === `undefined`)
      throw errors.EBADF(`ftruncate`);

    const [mountFs, realFd] = entry;
    return mountFs.ftruncatePromise(realFd, len);
  }

  ftruncateSync(fd: number, len?: number): void {
    if ((fd & MOUNT_MASK) !== this.magic)
      return this.baseFs.ftruncateSync(fd, len);

    const entry = this.fdMap.get(fd);
    if (typeof entry === `undefined`)
      throw errors.EBADF(`ftruncateSync`);

    const [mountFs, realFd] = entry;
    return mountFs.ftruncateSync(realFd, len);
  }

  watch(p: PortablePath, cb?: WatchCallback): Watcher;
  watch(p: PortablePath, opts: WatchOptions, cb?: WatchCallback): Watcher;
  watch(p: PortablePath, a?: WatchOptions | WatchCallback, b?: WatchCallback) {
    return this.makeCallSync(p, () => {
      return this.baseFs.watch(
        p,
        // @ts-expect-error
        a,
        b,
      );
    }, (mountFs, {subPath}) => {
      return mountFs.watch(
        subPath,
        // @ts-expect-error
        a,
        b,
      );
    });
  }

  watchFile(p: PortablePath, cb: WatchFileCallback): StatWatcher;
  watchFile(p: PortablePath, opts: WatchFileOptions, cb: WatchFileCallback): StatWatcher;
  watchFile(p: PortablePath, a: WatchFileOptions | WatchFileCallback, b?: WatchFileCallback) {
    return this.makeCallSync(p, () => {
      return this.baseFs.watchFile(
        p,
        // @ts-expect-error
        a,
        b,
      );
    }, () => {
      return watchFile(this, p, a, b);
    });
  }

  unwatchFile(p: PortablePath, cb?: WatchFileCallback): void {
    return this.makeCallSync(p, () => {
      return this.baseFs.unwatchFile(p, cb);
    }, () => {
      return unwatchFile(this, p, cb);
    });
  }

  private async makeCallPromise<T>(p: FSPath<PortablePath>, discard: () => Promise<T>, accept: (mountFS: MountedFS, mountInfo: {archivePath: PortablePath, subPath: PortablePath}) => Promise<T>, {requireSubpath = true}: {requireSubpath?: boolean} = {}): Promise<T> {
    if (typeof p !== `string`)
      return await discard();

    const normalizedP = this.resolve(p);

    const mountInfo = this.findMount(normalizedP);
    if (!mountInfo)
      return await discard();

    if (requireSubpath && mountInfo.subPath === `/`)
      return await discard();

    return await this.getMountPromise(mountInfo.archivePath, async mountFs => await accept(mountFs, mountInfo));
  }

  private makeCallSync<T>(p: FSPath<PortablePath>, discard: () => T, accept: (mountFS: MountedFS, mountInfo: {archivePath: PortablePath, subPath: PortablePath}) => T, {requireSubpath = true}: {requireSubpath?: boolean} = {}): T {
    if (typeof p !== `string`)
      return discard();

    const normalizedP = this.resolve(p);

    const mountInfo = this.findMount(normalizedP);
    if (!mountInfo)
      return discard();

    if (requireSubpath && mountInfo.subPath === `/`)
      return discard();

    return this.getMountSync(mountInfo.archivePath, mountFs => accept(mountFs, mountInfo));
  }

  private findMount(p: PortablePath) {
    if (this.filter && !this.filter.test(p))
      return null;

    let filePath = `` as PortablePath;

    while (true) {
      const pathPartWithArchive = p.substring(filePath.length) as PortablePath;

      const mountPoint = this.getMountPoint(pathPartWithArchive, filePath);
      if (!mountPoint)
        return null;

      filePath = this.pathUtils.join(filePath, mountPoint);

      if (!this.isMount.has(filePath)) {
        if (this.notMount.has(filePath))
          continue;

        try {
          if (this.typeCheck !== null && (this.baseFs.lstatSync(filePath).mode & constants.S_IFMT) !== this.typeCheck) {
            this.notMount.add(filePath);
            continue;
          }
        } catch {
          return null;
        }

        this.isMount.add(filePath);
      }

      return {
        archivePath: filePath,
        subPath: this.pathUtils.join(PortablePath.root, p.substring(filePath.length) as PortablePath),
      };
    }
  }

  private limitOpenFilesTimeout: NodeJS.Timeout | null = null;
  private limitOpenFiles(max: number | null) {
    if (this.mountInstances === null)
      return;

    const now = Date.now();
    let nextExpiresAt = now + this.maxAge;
    let closeCount = max === null ? 0 : this.mountInstances.size - max;

    for (const [path, {childFs, expiresAt, refCount}] of this.mountInstances.entries()) {
      if (refCount !== 0 || childFs.hasOpenFileHandles?.()) {
        continue;
      } else if (now >= expiresAt) {
        childFs.saveAndClose?.();
        this.mountInstances.delete(path);
        closeCount -= 1;
        continue;
      } else if (max === null || closeCount <= 0) {
        nextExpiresAt = expiresAt;
        break;
      }

      childFs.saveAndClose?.();
      this.mountInstances.delete(path);
      closeCount -= 1;
    }

    if (this.limitOpenFilesTimeout === null && ((max === null && this.mountInstances.size > 0) || max !== null) && isFinite(nextExpiresAt)) {
      this.limitOpenFilesTimeout = setTimeout(() => {
        this.limitOpenFilesTimeout = null;
        this.limitOpenFiles(null);
      }, nextExpiresAt - now).unref();
    }
  }

  private async getMountPromise<T>(p: PortablePath, accept: (mountFs: MountedFS) => Promise<T>) {
    if (this.mountInstances) {
      let cachedMountFs = this.mountInstances.get(p);

      if (!cachedMountFs) {
        const createFsInstance = await this.factoryPromise(this.baseFs, p);

        // We need to recheck because concurrent getMountPromise calls may
        // have instantiated the mount archive while we were waiting
        cachedMountFs = this.mountInstances.get(p);
        if (!cachedMountFs) {
          cachedMountFs = {
            childFs: createFsInstance(),
            expiresAt: 0,
            refCount: 0,
          };
        }
      }

      // Removing then re-adding the field allows us to easily implement
      // a basic LRU garbage collection strategy
      this.mountInstances.delete(p);
      this.limitOpenFiles(this.maxOpenFiles - 1);
      this.mountInstances.set(p, cachedMountFs);

      cachedMountFs.expiresAt = Date.now() + this.maxAge;
      cachedMountFs.refCount += 1;
      try {
        return await accept(cachedMountFs.childFs);
      } finally {
        cachedMountFs.refCount -= 1;
      }
    } else {
      const mountFs = (await this.factoryPromise(this.baseFs, p))();

      try {
        return await accept(mountFs);
      } finally {
        mountFs.saveAndClose?.();
      }
    }
  }

  private getMountSync<T>(p: PortablePath, accept: (mountFs: MountedFS) => T) {
    if (this.mountInstances) {
      let cachedMountFs = this.mountInstances.get(p);

      if (!cachedMountFs) {
        cachedMountFs = {
          childFs: this.factorySync(this.baseFs, p),
          expiresAt: 0,
          refCount: 0,
        };
      }

      // Removing then re-adding the field allows us to easily implement
      // a basic LRU garbage collection strategy
      this.mountInstances.delete(p);
      this.limitOpenFiles(this.maxOpenFiles - 1);
      this.mountInstances.set(p, cachedMountFs);

      cachedMountFs.expiresAt = Date.now() + this.maxAge;
      return accept(cachedMountFs.childFs);
    } else {
      const childFs = this.factorySync(this.baseFs, p);

      try {
        return accept(childFs);
      } finally {
        childFs.saveAndClose?.();
      }
    }
  }
}
