import {constants}                                                             from 'fs';

import {CreateReadStreamOptions, CreateWriteStreamOptions, BasePortableFakeFS} from './FakeFS';
import {FakeFS, MkdirOptions, WriteFileOptions}                                from './FakeFS';
import {WatchOptions, WatchCallback, Watcher}                                  from './FakeFS';
import {NodeFS}                                                                from './NodeFS';
import {ZipFS}                                                                 from './ZipFS';
import {FSPath, PortablePath}                                                  from './path';

const ZIP_FD = 0x80000000;

export type ZipOpenFSOptions = {
  baseFs?: FakeFS<PortablePath>,
  filter?: RegExp | null,
  readOnlyArchives?: boolean,
  useCache?: boolean,
};

export class ZipOpenFS extends BasePortableFakeFS {
  static open<T>(fn: (zipOpenFs: ZipOpenFS) => Promise<T>): Promise<T> {
    const zipOpenFs = new ZipOpenFS();
    try {
      return fn(zipOpenFs);
    } finally {
      zipOpenFs.saveAndClose();
    }
  }

  static async openPromise<T>(fn: (zipOpenFs: ZipOpenFS) => Promise<T>): Promise<T> {
    const zipOpenFs = new ZipOpenFS();
    try {
      return await fn(zipOpenFs);
    } finally {
      zipOpenFs.saveAndClose();
    }
  }

  private readonly baseFs: FakeFS<PortablePath>;

  private readonly zipInstances: Map<string, ZipFS> | null;

  private readonly fdMap: Map<number, [ZipFS, number]> = new Map();
  private nextFd = 3;

  private readonly filter?: RegExp | null;
  private readonly readOnlyArchives?: boolean;

  private isZip: Set<string> = new Set();
  private notZip: Set<string> = new Set();

  constructor({baseFs = new NodeFS(), filter = null, readOnlyArchives = false, useCache = true}: ZipOpenFSOptions = {}) {
    super();

    this.baseFs = baseFs;

    this.zipInstances = useCache ? new Map() : null;

    this.filter = filter;
    this.readOnlyArchives = readOnlyArchives;

    this.isZip = new Set();
    this.notZip = new Set();
  }

  getRealPath() {
    return this.baseFs.getRealPath();
  }

  saveAndClose() {
    if (this.zipInstances) {
      for (const [path, zipFs] of this.zipInstances.entries()) {
        zipFs.saveAndClose();
        this.zipInstances.delete(path);
      }
    }
  }

  discardAndClose() {
    if (this.zipInstances) {
      for (const [path, zipFs] of this.zipInstances.entries()) {
        zipFs.discardAndClose();
        this.zipInstances.delete(path);
      }
    }
  }

  private remapFd(zipFs: ZipFS, fd: number) {
    const remappedFd = this.nextFd++ | ZIP_FD;
    this.fdMap.set(remappedFd, [zipFs, fd]);
    return remappedFd;
  }

  async openPromise(p: PortablePath, flags: string, mode?: number) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.openPromise(p, flags, mode);
    }, async (zipFs, {subPath}) => {
      return this.remapFd(zipFs, await zipFs.openPromise(subPath, flags, mode));
    });
  }

  openSync(p: PortablePath, flags: string, mode?: number) {
    return this.makeCallSync(p, () => {
      return this.baseFs.openSync(p, flags, mode);
    }, (zipFs, {subPath}) => {
      return this.remapFd(zipFs, zipFs.openSync(subPath, flags, mode));
    });
  }

  async readPromise(fd: number, buffer: Buffer, offset: number, length: number, position: number) {
    if ((fd & ZIP_FD) === 0)
      return await this.baseFs.readPromise(fd, buffer, offset, length, position);

    const entry = this.fdMap.get(fd);
    if (typeof entry === `undefined`)
      throw Object.assign(new Error(`EBADF: bad file descriptor, read`), {code: `EBADF`});

    const [zipFs, realFd] = entry;
    return await zipFs.readPromise(realFd, buffer, offset, length, position);
  }

  readSync(fd: number, buffer: Buffer, offset: number, length: number, position: number) {
    if ((fd & ZIP_FD) === 0)
      return this.baseFs.readSync(fd, buffer, offset, length, position);

    const entry = this.fdMap.get(fd);
    if (typeof entry === `undefined`)
      throw Object.assign(new Error(`EBADF: bad file descriptor, read`), {code: `EBADF`});

    const [zipFs, realFd] = entry;
    return zipFs.readSync(realFd, buffer, offset, length, position);
  }

  writePromise(fd: number, buffer: Buffer, offset?: number, length?: number, position?: number): Promise<number>;
  writePromise(fd: number, buffer: string, position?: number): Promise<number>;
  async writePromise(fd: number, buffer: Buffer | string, offset?: number, length?: number, position?: number): Promise<number> {
    if ((fd & ZIP_FD) === 0) {
      if (typeof buffer === `string`) {
        return await this.baseFs.writePromise(fd, buffer, offset);
      } else {
        return await this.baseFs.writePromise(fd, buffer, offset, length, position);
      }
    }

    const entry = this.fdMap.get(fd);
    if (typeof entry === `undefined`)
      throw Object.assign(new Error(`EBADF: bad file descriptor, write`), {code: `EBADF`});

    const [zipFs, realFd] = entry;

    if (typeof buffer === `string`) {
      return await zipFs.writePromise(realFd, buffer, offset);
    } else {
      return await zipFs.writePromise(realFd, buffer, offset, length, position);
    }
  }

  writeSync(fd: number, buffer: Buffer, offset?: number, length?: number, position?: number): number;
  writeSync(fd: number, buffer: string, position?: number): number;
  writeSync(fd: number, buffer: Buffer | string, offset?: number, length?: number, position?: number): number {
    if ((fd & ZIP_FD) === 0) {
      if (typeof buffer === `string`) {
        return this.baseFs.writeSync(fd, buffer, offset);
      } else {
        return this.baseFs.writeSync(fd, buffer, offset, length, position);
      }
    }

    const entry = this.fdMap.get(fd);
    if (typeof entry === `undefined`)
      throw Object.assign(new Error(`EBADF: bad file descriptor, write`), {code: `EBADF`});

    const [zipFs, realFd] = entry;

    if (typeof buffer === `string`) {
      return zipFs.writeSync(realFd, buffer, offset);
    } else {
      return zipFs.writeSync(realFd, buffer, offset, length, position);
    }
  }

  async closePromise(fd: number) {
    if ((fd & ZIP_FD) === 0)
      return await this.baseFs.closePromise(fd);

    const entry = this.fdMap.get(fd);
    if (typeof entry === `undefined`)
      throw Object.assign(new Error(`EBADF: bad file descriptor, close`), {code: `EBADF`});

    this.fdMap.delete(fd);

    const [zipFs, realFd] = entry;
    return await zipFs.closePromise(realFd);
  }

  closeSync(fd: number) {
    if ((fd & ZIP_FD) === 0)
      return this.baseFs.closeSync(fd);

    const entry = this.fdMap.get(fd);
    if (typeof entry === `undefined`)
      throw Object.assign(new Error(`EBADF: bad file descriptor, close`), {code: `EBADF`});

    this.fdMap.delete(fd);

    const [zipFs, realFd] = entry;
    return zipFs.closeSync(realFd);
  }

  createReadStream(p: PortablePath | null, opts?: CreateReadStreamOptions) {
    if (p === null)
      return this.baseFs.createReadStream(p, opts);

    return this.makeCallSync(p, () => {
      return this.baseFs.createReadStream(p, opts);
    }, (zipFs, {subPath}) => {
      return zipFs.createReadStream(subPath, opts);
    });
  }

  createWriteStream(p: PortablePath | null, opts?: CreateWriteStreamOptions) {
    if (p === null)
      return this.baseFs.createWriteStream(p, opts);

    return this.makeCallSync(p, () => {
      return this.baseFs.createWriteStream(p, opts);
    }, (zipFs, {subPath}) => {
      return zipFs.createWriteStream(subPath, opts);
    });
  }

  async realpathPromise(p: PortablePath) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.realpathPromise(p);
    }, async (zipFs, {archivePath, subPath}) => {
      return this.pathUtils.resolve(await this.baseFs.realpathPromise(archivePath), this.pathUtils.relative(PortablePath.root, await zipFs.realpathPromise(subPath)));
    });
  }

  realpathSync(p: PortablePath) {
    return this.makeCallSync(p, () => {
      return this.baseFs.realpathSync(p);
    }, (zipFs, {archivePath, subPath}) => {
      return this.pathUtils.resolve(this.baseFs.realpathSync(archivePath), this.pathUtils.relative(PortablePath.root, zipFs.realpathSync(subPath)));
    });
  }

  async existsPromise(p: PortablePath) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.existsPromise(p);
    }, async (zipFs, {subPath}) => {
      return await zipFs.existsPromise(subPath);
    });
  }

  existsSync(p: PortablePath) {
    return this.makeCallSync(p, () => {
      return this.baseFs.existsSync(p);
    }, (zipFs, {subPath}) => {
      return zipFs.existsSync(subPath);
    });
  }

  async accessPromise(p: PortablePath, mode?: number) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.accessPromise(p, mode);
    }, async (zipFs, {subPath}) => {
      return await zipFs.accessPromise(subPath, mode);
    });
  }

  accessSync(p: PortablePath, mode?: number) {
    return this.makeCallSync(p, () => {
      return this.baseFs.accessSync(p, mode);
    }, (zipFs, {subPath}) => {
      return zipFs.accessSync(subPath, mode);
    });
  }

  async statPromise(p: PortablePath) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.statPromise(p);
    }, async (zipFs, {subPath}) => {
      return await zipFs.statPromise(subPath);
    });
  }

  statSync(p: PortablePath) {
    return this.makeCallSync(p, () => {
      return this.baseFs.statSync(p);
    }, (zipFs, {subPath}) => {
      return zipFs.statSync(subPath);
    });
  }

  async lstatPromise(p: PortablePath) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.lstatPromise(p);
    }, async (zipFs, {subPath}) => {
      return await zipFs.lstatPromise(subPath);
    });
  }

  lstatSync(p: PortablePath) {
    return this.makeCallSync(p, () => {
      return this.baseFs.lstatSync(p);
    }, (zipFs, {subPath}) => {
      return zipFs.lstatSync(subPath);
    });
  }

  async chmodPromise(p: PortablePath, mask: number) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.chmodPromise(p, mask);
    }, async (zipFs, {subPath}) => {
      return await zipFs.chmodPromise(subPath, mask);
    });
  }

  chmodSync(p: PortablePath, mask: number) {
    return this.makeCallSync(p, () => {
      return this.baseFs.chmodSync(p, mask);
    }, (zipFs, {subPath}) => {
      return zipFs.chmodSync(subPath, mask);
    });
  }

  async renamePromise(oldP: PortablePath, newP: PortablePath) {
    return await this.makeCallPromise(oldP, async () => {
      return await this.makeCallPromise(newP, async () => {
        return await this.baseFs.renamePromise(oldP, newP);
      }, async () => {
        throw Object.assign(new Error(`EEXDEV: cross-device link not permitted`), {code: `EEXDEV`});
      });
    }, async (zipFsO, {subPath: subPathO}) => {
      return await this.makeCallPromise(newP, async () => {
        throw Object.assign(new Error(`EEXDEV: cross-device link not permitted`), {code: `EEXDEV`});
      }, async (zipFsN, {subPath: subPathN}) => {
        if (zipFsO !== zipFsN) {
          throw Object.assign(new Error(`EEXDEV: cross-device link not permitted`), {code: `EEXDEV`});
        } else {
          return await zipFsO.renamePromise(subPathO, subPathN);
        }
      });
    });
  }

  renameSync(oldP: PortablePath, newP: PortablePath) {
    return this.makeCallSync(oldP, () => {
      return this.makeCallSync(newP, () => {
        return this.baseFs.renameSync(oldP, newP);
      }, async () => {
        throw Object.assign(new Error(`EEXDEV: cross-device link not permitted`), {code: `EEXDEV`});
      });
    }, (zipFsO, {subPath: subPathO}) => {
      return this.makeCallSync(newP, () => {
        throw Object.assign(new Error(`EEXDEV: cross-device link not permitted`), {code: `EEXDEV`});
      }, (zipFsN, {subPath: subPathN}) => {
        if (zipFsO !== zipFsN) {
          throw Object.assign(new Error(`EEXDEV: cross-device link not permitted`), {code: `EEXDEV`});
        } else {
          return zipFsO.renameSync(subPathO, subPathN);
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
      }, async (zipFsD, {subPath: subPathD}) => {
        return await fallback(this.baseFs, sourceP, zipFsD, subPathD);
      });
    }, async (zipFsS, {subPath: subPathS}) => {
      return await this.makeCallPromise(destP, async () => {
        return await fallback(zipFsS, subPathS, this.baseFs, destP);
      }, async (zipFsD, {subPath: subPathD}) => {
        if (zipFsS !== zipFsD) {
          return await fallback(zipFsS, subPathS, zipFsD, subPathD);
        } else {
          return await zipFsS.copyFilePromise(subPathS, subPathD, flags);
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
      }, (zipFsD, {subPath: subPathD}) => {
        return fallback(this.baseFs, sourceP, zipFsD, subPathD);
      });
    }, (zipFsS, {subPath: subPathS}) => {
      return this.makeCallSync(destP, () => {
        return fallback(zipFsS, subPathS, this.baseFs, destP);
      }, (zipFsD, {subPath: subPathD}) => {
        if (zipFsS !== zipFsD) {
          return fallback(zipFsS, subPathS, zipFsD, subPathD);
        } else {
          return zipFsS.copyFileSync(subPathS, subPathD, flags);
        }
      });
    });
  }

  async appendFilePromise(p: FSPath<PortablePath>, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.appendFilePromise(p, content, opts);
    }, async (zipFs, {subPath}) => {
      return await zipFs.appendFilePromise(subPath, content, opts);
    });
  }

  appendFileSync(p: FSPath<PortablePath>, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return this.makeCallSync(p, () => {
      return this.baseFs.appendFileSync(p, content, opts);
    }, (zipFs, {subPath}) => {
      return zipFs.appendFileSync(subPath, content, opts);
    });
  }

  async writeFilePromise(p: FSPath<PortablePath>, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.writeFilePromise(p, content, opts);
    }, async (zipFs, {subPath}) => {
      return await zipFs.writeFilePromise(subPath, content, opts);
    });
  }

  writeFileSync(p: FSPath<PortablePath>, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return this.makeCallSync(p, () => {
      return this.baseFs.writeFileSync(p, content, opts);
    }, (zipFs, {subPath}) => {
      return zipFs.writeFileSync(subPath, content, opts);
    });
  }

  async unlinkPromise(p: PortablePath) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.unlinkPromise(p);
    }, async (zipFs, {subPath}) => {
      return await zipFs.unlinkPromise(subPath);
    });
  }

  unlinkSync(p: PortablePath) {
    return this.makeCallSync(p, () => {
      return this.baseFs.unlinkSync(p);
    }, (zipFs, {subPath}) => {
      return zipFs.unlinkSync(subPath);
    });
  }

  async utimesPromise(p: PortablePath, atime: Date | string | number, mtime: Date | string | number) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.utimesPromise(p, atime, mtime);
    }, async (zipFs, {subPath}) => {
      return await zipFs.utimesPromise(subPath, atime, mtime);
    });
  }

  utimesSync(p: PortablePath, atime: Date | string | number, mtime: Date | string | number) {
    return this.makeCallSync(p, () => {
      return this.baseFs.utimesSync(p, atime, mtime);
    }, (zipFs, {subPath}) => {
      return zipFs.utimesSync(subPath, atime, mtime);
    });
  }

  async mkdirPromise(p: PortablePath, opts?: MkdirOptions) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.mkdirPromise(p, opts);
    }, async (zipFs, {subPath}) => {
      return await zipFs.mkdirPromise(subPath, opts);
    });
  }

  mkdirSync(p: PortablePath, opts?: MkdirOptions) {
    return this.makeCallSync(p, () => {
      return this.baseFs.mkdirSync(p, opts);
    }, (zipFs, {subPath}) => {
      return zipFs.mkdirSync(subPath, opts);
    });
  }

  async rmdirPromise(p: PortablePath) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.rmdirPromise(p);
    }, async (zipFs, {subPath}) => {
      return await zipFs.rmdirPromise(subPath);
    });
  }

  rmdirSync(p: PortablePath) {
    return this.makeCallSync(p, () => {
      return this.baseFs.rmdirSync(p);
    }, (zipFs, {subPath}) => {
      return zipFs.rmdirSync(subPath);
    });
  }

  async symlinkPromise(target: PortablePath, p: PortablePath) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.symlinkPromise(target, p);
    }, async (zipFs, {subPath}) => {
      return await zipFs.symlinkPromise(target, subPath);
    });
  }

  symlinkSync(target: PortablePath, p: PortablePath) {
    return this.makeCallSync(p, () => {
      return this.baseFs.symlinkSync(target, p);
    }, (zipFs, {subPath}) => {
      return zipFs.symlinkSync(target, subPath);
    });
  }

  readFilePromise(p: FSPath<PortablePath>, encoding: 'utf8'): Promise<string>;
  readFilePromise(p: FSPath<PortablePath>, encoding?: string): Promise<Buffer>;
  async readFilePromise(p: FSPath<PortablePath>, encoding?: string) {
    return this.makeCallPromise(p, async () => {
      // This weird switch is required to tell TypeScript that the signatures are proper (otherwise it thinks that only the generic one is covered)
      switch (encoding) {
        case `utf8`:
          return await this.baseFs.readFilePromise(p, encoding);
        default:
          return await this.baseFs.readFilePromise(p, encoding);
      }
    }, async (zipFs, {subPath}) => {
      return await zipFs.readFilePromise(subPath, encoding);
    });
  }

  readFileSync(p: FSPath<PortablePath>, encoding: 'utf8'): string;
  readFileSync(p: FSPath<PortablePath>, encoding?: string): Buffer;
  readFileSync(p: FSPath<PortablePath>, encoding?: string) {
    return this.makeCallSync(p, () => {
      // This weird switch is required to tell TypeScript that the signatures are proper (otherwise it thinks that only the generic one is covered)
      switch (encoding) {
        case `utf8`:
          return this.baseFs.readFileSync(p, encoding);
        default:
          return this.baseFs.readFileSync(p, encoding);
      }
    }, (zipFs, {subPath}) => {
      return zipFs.readFileSync(subPath, encoding);
    });
  }

  async readdirPromise(p: PortablePath) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.readdirPromise(p);
    }, async (zipFs, {subPath}) => {
      return await zipFs.readdirPromise(subPath);
    }, {
      requireSubpath: false,
    });
  }

  readdirSync(p: PortablePath) {
    return this.makeCallSync(p, () => {
      return this.baseFs.readdirSync(p);
    }, (zipFs, {subPath}) => {
      return zipFs.readdirSync(subPath);
    }, {
      requireSubpath: false,
    });
  }

  async readlinkPromise(p: PortablePath) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.readlinkPromise(p);
    }, async (zipFs, {subPath}) => {
      return await zipFs.readlinkPromise(subPath);
    });
  }

  readlinkSync(p: PortablePath) {
    return this.makeCallSync(p, () => {
      return this.baseFs.readlinkSync(p);
    }, (zipFs, {subPath}) => {
      return zipFs.readlinkSync(subPath);
    });
  }

  watch(p: PortablePath, cb?: WatchCallback): Watcher;
  watch(p: PortablePath, opts: WatchOptions, cb?: WatchCallback): Watcher;
  watch(p: PortablePath, a?: WatchOptions | WatchCallback, b?: WatchCallback) {
    return this.makeCallSync(p, () => {
      return this.baseFs.watch(
        p,
        // @ts-ignore
        a,
        b,
      );
    }, (zipFs, {subPath}) => {
      return zipFs.watch(
        subPath,
        // @ts-ignore
        a,
        b,
      );
    });
  }

  private async makeCallPromise<T>(p: FSPath<PortablePath>, discard: () => Promise<T>, accept: (zipFS: ZipFS, zipInfo: {archivePath: PortablePath, subPath: PortablePath}) => Promise<T>, {requireSubpath = true}: {requireSubpath?: boolean} = {}): Promise<T> {
    if (typeof p !== `string`)
      return await discard();

    const normalizedP = this.pathUtils.normalize(this.pathUtils.resolve(PortablePath.root, p));

    const zipInfo = this.findZip(normalizedP);
    if (!zipInfo)
      return await discard();

    if (requireSubpath && zipInfo.subPath === `/`)
      return await discard();

    return await this.getZipPromise(zipInfo.archivePath, async zipFs => await accept(zipFs, zipInfo));
  }

  private makeCallSync<T>(p: FSPath<PortablePath>, discard: () => T, accept: (zipFS: ZipFS, zipInfo: {archivePath: PortablePath, subPath: PortablePath}) => T, {requireSubpath = true}: {requireSubpath?: boolean} = {}): T {
    if (typeof p !== `string`)
      return discard();

    const normalizedP = this.pathUtils.normalize(this.pathUtils.resolve(PortablePath.root, p));

    const zipInfo = this.findZip(normalizedP);
    if (!zipInfo)
      return discard();

    if (requireSubpath && zipInfo.subPath === `/`)
      return discard();

    return this.getZipSync(zipInfo.archivePath, zipFs => accept(zipFs, zipInfo));
  }

  private findZip(p: PortablePath) {
    if (this.filter && !this.filter.test(p))
      return null;

    const parts = p.split(/\//g);

    for (let t = 2; t <= parts.length; ++t) {
      const archivePath = parts.slice(0, t).join(`/`) as PortablePath;

      if (this.notZip.has(archivePath))
        continue;

      if (this.isZip.has(archivePath))
        return {archivePath, subPath: this.pathUtils.resolve(PortablePath.root, parts.slice(t).join(`/`) as PortablePath)};

      let realArchivePath = archivePath;
      let stat;

      while (true) {
        try {
          stat = this.baseFs.lstatSync(realArchivePath);
        } catch (error) {
          return null;
        }

        if (stat.isSymbolicLink()) {
          realArchivePath = this.pathUtils.resolve(this.pathUtils.dirname(realArchivePath), this.baseFs.readlinkSync(realArchivePath));
        } else {
          break;
        }
      }

      const isZip = stat.isFile() && this.pathUtils.extname(realArchivePath) === `.zip`;

      if (isZip) {
        this.isZip.add(archivePath);
        return {archivePath, subPath: this.pathUtils.resolve(PortablePath.root, parts.slice(t).join(`/`) as PortablePath)};
      } else {
        this.notZip.add(archivePath);
        if (stat.isFile()) {
          return null;
        }
      }
    }

    return null;
  }

  private async getZipPromise<T>(p: PortablePath, accept: (zipFs: ZipFS) => Promise<T>) {
    const getZipOptions = async () => ({
      baseFs: this.baseFs,
      readOnly: this.readOnlyArchives,
      stats: await this.baseFs.statPromise(p),
    });

    if (this.zipInstances) {
      let zipFs = this.zipInstances.get(p);

      if (!zipFs)
        this.zipInstances.set(p, zipFs = new ZipFS(p, await getZipOptions()));

      return await accept(zipFs);
    } else {
      const zipFs = new ZipFS(p, await getZipOptions());

      try {
        return await accept(zipFs);
      } finally {
        zipFs.saveAndClose();
      }
    }
  }

  private getZipSync<T>(p: PortablePath, accept: (zipFs: ZipFS) => T) {
    const getZipOptions = () => ({
      baseFs: this.baseFs,
      readOnly: this.readOnlyArchives,
      stats: this.baseFs.statSync(p),
    });

    if (this.zipInstances) {
      let zipFs = this.zipInstances.get(p);

      if (!zipFs)
        this.zipInstances.set(p, zipFs = new ZipFS(p, getZipOptions()));

      return accept(zipFs);
    } else {
      const zipFs = new ZipFS(p, getZipOptions());

      try {
        return accept(zipFs);
      } finally {
        zipFs.saveAndClose();
      }
    }
  }
}
