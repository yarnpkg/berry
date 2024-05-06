import fs, {BigIntStats, Stats}                                                                                                                                 from 'fs';

import {CreateReadStreamOptions, CreateWriteStreamOptions, Dir, StatWatcher, WatchFileCallback, WatchFileOptions, OpendirOptions, ReaddirOptions, DirentNoPath} from './FakeFS';
import {Dirent, SymlinkType, StatSyncOptions, StatOptions}                                                                                                      from './FakeFS';
import {BasePortableFakeFS, WriteFileOptions}                                                                                                                   from './FakeFS';
import {MkdirOptions, RmdirOptions, RmOptions, WatchOptions, WatchCallback, Watcher}                                                                            from './FakeFS';
import {FSPath, PortablePath, Filename, ppath, npath, NativePath}                                                                                               from './path';

function direntToPortable(dirent: Dirent<NativePath>): Dirent<PortablePath> {
  // We don't need to return a copy, we can just reuse the object the real fs returned
  const portableDirent = dirent as Dirent<PortablePath>;

  if (typeof dirent.path === `string`)
    portableDirent.path = npath.toPortablePath(dirent.path);

  return portableDirent;
}

export class NodeFS extends BasePortableFakeFS {
  private readonly realFs: typeof fs;

  constructor(realFs: typeof fs = fs) {
    super();

    this.realFs = realFs;
  }

  getExtractHint() {
    return false;
  }

  getRealPath() {
    return PortablePath.root;
  }

  resolve(p: PortablePath) {
    return ppath.resolve(p);
  }

  async openPromise(p: PortablePath, flags: string, mode?: number) {
    return await new Promise<number>((resolve, reject) => {
      this.realFs.open(npath.fromPortablePath(p), flags, mode, this.makeCallback(resolve, reject));
    });
  }

  openSync(p: PortablePath, flags: string, mode?: number) {
    return this.realFs.openSync(npath.fromPortablePath(p), flags, mode);
  }

  async opendirPromise(p: PortablePath, opts?: OpendirOptions): Promise<Dir<PortablePath>> {
    return await new Promise<fs.Stats>((resolve, reject) => {
      if (typeof opts !== `undefined`) {
        this.realFs.opendir(npath.fromPortablePath(p), opts, this.makeCallback(resolve, reject) as any);
      } else {
        this.realFs.opendir(npath.fromPortablePath(p), this.makeCallback(resolve, reject) as any);
      }
    }).then(dir => {
      // @ts-expect-error
      //
      // We need a way to tell TS that the values returned by the `read`
      // methods are compatible with `Dir`, especially the `name` field.
      //
      // We also can't use `Object.assign` to set the because the `path`
      // field to a Filename, because the property isn't writable, so
      // we need to use defineProperty instead.
      //
      const dirWithFixedPath: Dir<PortablePath> = dir;

      Object.defineProperty(dirWithFixedPath, `path`, {
        value: p,
        configurable: true,
        writable: true,
      });

      return dirWithFixedPath;
    });
  }

  opendirSync(p: PortablePath, opts?: OpendirOptions) {
    const dir: Omit<fs.Dir, `path`> = typeof opts !== `undefined`
      ? this.realFs.opendirSync(npath.fromPortablePath(p), opts)
      : this.realFs.opendirSync(npath.fromPortablePath(p));

    // @ts-expect-error
    //
    // We need a way to tell TS that the values returned by the `read`
    // methods are compatible with `Dir`, especially the `name` field.
    //
    // We also can't use `Object.assign` to set the because the `path`
    // field to a Filename, because the property isn't writable, so
    // we need to use defineProperty instead.
    //
    const dirWithFixedPath: Dir<PortablePath> = dir;

    Object.defineProperty(dirWithFixedPath, `path`, {
      value: p,
      configurable: true,
      writable: true,
    });

    return dirWithFixedPath;
  }

  async readPromise(fd: number, buffer: Buffer, offset: number = 0, length: number = 0, position: number | null = -1) {
    return await new Promise<number>((resolve, reject) => {
      this.realFs.read(fd, buffer, offset, length, position, (error, bytesRead) => {
        if (error) {
          reject(error);
        } else {
          resolve(bytesRead);
        }
      });
    });
  }

  readSync(fd: number, buffer: Buffer, offset: number, length: number, position: number) {
    return this.realFs.readSync(fd, buffer, offset, length, position);
  }

  writePromise(fd: number, buffer: Buffer, offset?: number, length?: number, position?: number): Promise<number>;
  writePromise(fd: number, buffer: string, position?: number): Promise<number>;
  async writePromise(fd: number, buffer: Buffer | string, offset?: number, length?: number, position?: number): Promise<number> {
    return await new Promise<number>((resolve, reject) => {
      if (typeof buffer === `string`) {
        return this.realFs.write(fd, buffer, offset, this.makeCallback(resolve, reject));
      } else {
        return this.realFs.write(fd, buffer, offset, length, position, this.makeCallback(resolve, reject));
      }
    });
  }

  writeSync(fd: number, buffer: Buffer, offset?: number, length?: number, position?: number): number;
  writeSync(fd: number, buffer: string, position?: number): number;
  writeSync(fd: number, buffer: Buffer | string, offset?: number, length?: number, position?: number) {
    if (typeof buffer === `string`) {
      return this.realFs.writeSync(fd, buffer, offset);
    } else {
      return this.realFs.writeSync(fd, buffer, offset, length, position);
    }
  }

  async closePromise(fd: number) {
    await new Promise<void>((resolve, reject) => {
      this.realFs.close(fd, this.makeCallback(resolve, reject));
    });
  }

  closeSync(fd: number) {
    this.realFs.closeSync(fd);
  }

  createReadStream(p: PortablePath | null, opts?: CreateReadStreamOptions) {
    const realPath = (p !== null ? npath.fromPortablePath(p) : p) as fs.PathLike;
    return this.realFs.createReadStream(realPath, opts);
  }

  createWriteStream(p: PortablePath | null, opts?: CreateWriteStreamOptions) {
    const realPath = (p !== null ? npath.fromPortablePath(p) : p) as fs.PathLike;
    return this.realFs.createWriteStream(realPath, opts);
  }

  async realpathPromise(p: PortablePath) {
    return await new Promise<string>((resolve, reject) => {
      this.realFs.realpath(npath.fromPortablePath(p), {}, this.makeCallback(resolve, reject));
    }).then(path => {
      return npath.toPortablePath(path);
    });
  }

  realpathSync(p: PortablePath) {
    return npath.toPortablePath(this.realFs.realpathSync(npath.fromPortablePath(p), {}));
  }

  async existsPromise(p: PortablePath) {
    return await new Promise<boolean>(resolve => {
      this.realFs.exists(npath.fromPortablePath(p), resolve);
    });
  }

  accessSync(p: PortablePath, mode?: number) {
    return this.realFs.accessSync(npath.fromPortablePath(p), mode);
  }

  async accessPromise(p: PortablePath, mode?: number) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.access(npath.fromPortablePath(p), mode, this.makeCallback(resolve, reject));
    });
  }

  existsSync(p: PortablePath) {
    return this.realFs.existsSync(npath.fromPortablePath(p));
  }

  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/51d793492d4c2e372b01257668dcd3afc58d7352/types/node/v16/fs.d.ts#L1042-L1059
  async statPromise(p: PortablePath): Promise<Stats>;
  async statPromise(p: PortablePath, opts: (StatOptions & { bigint?: false | undefined }) | undefined): Promise<Stats>;
  async statPromise(p: PortablePath, opts: StatOptions & { bigint: true }): Promise<BigIntStats>;
  async statPromise(p: PortablePath, opts?: StatOptions): Promise<Stats | BigIntStats> {
    return await new Promise<BigIntStats | Stats>((resolve, reject) => {
      if (opts) {
        this.realFs.stat(npath.fromPortablePath(p), opts, this.makeCallback(resolve, reject));
      } else {
        this.realFs.stat(npath.fromPortablePath(p), this.makeCallback(resolve, reject));
      }
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
    if (opts) {
      return this.realFs.statSync(npath.fromPortablePath(p), opts);
    } else {
      return this.realFs.statSync(npath.fromPortablePath(p));
    }
  }

  async fstatPromise(fd: number): Promise<Stats>;
  async fstatPromise(fd: number, opts: {bigint: true}): Promise<BigIntStats>;
  async fstatPromise(fd: number, opts?: {bigint: boolean}): Promise<BigIntStats | Stats>;
  async fstatPromise(fd: number, opts?: {bigint: boolean}) {
    return await new Promise<BigIntStats | Stats>((resolve, reject) => {
      if (opts) {
        this.realFs.fstat(fd, opts, this.makeCallback(resolve, reject));
      } else {
        this.realFs.fstat(fd, this.makeCallback(resolve, reject));
      }
    });
  }

  fstatSync(fd: number): Stats;
  fstatSync(fd: number, opts: {bigint: true}): BigIntStats;
  fstatSync(fd: number, opts?: {bigint: boolean}): BigIntStats | Stats;
  fstatSync(fd: number, opts?: {bigint: boolean}) {
    if (opts) {
      return this.realFs.fstatSync(fd, opts);
    } else {
      return this.realFs.fstatSync(fd);
    }
  }

  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/51d793492d4c2e372b01257668dcd3afc58d7352/types/node/v16/fs.d.ts#L1042-L1059
  async lstatPromise(p: PortablePath): Promise<Stats>;
  async lstatPromise(p: PortablePath, opts: (StatOptions & { bigint?: false | undefined }) | undefined): Promise<Stats>;
  async lstatPromise(p: PortablePath, opts: StatOptions & { bigint: true }): Promise<BigIntStats>;
  async lstatPromise(p: PortablePath, opts?: StatOptions): Promise<Stats | BigIntStats> {
    return await new Promise<BigIntStats | Stats>((resolve, reject) => {
      if (opts) {
        this.realFs.lstat(npath.fromPortablePath(p), opts, this.makeCallback(resolve, reject));
      } else {
        this.realFs.lstat(npath.fromPortablePath(p), this.makeCallback(resolve, reject));
      }
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
    if (opts) {
      return this.realFs.lstatSync(npath.fromPortablePath(p), opts);
    } else {
      return this.realFs.lstatSync(npath.fromPortablePath(p));
    }
  }

  async fchmodPromise(fd: number, mask: number): Promise<void> {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.fchmod(fd, mask, this.makeCallback(resolve, reject));
    });
  }

  fchmodSync(fd: number, mask: number): void {
    return this.realFs.fchmodSync(fd, mask);
  }

  async chmodPromise(p: PortablePath, mask: number) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.chmod(npath.fromPortablePath(p), mask, this.makeCallback(resolve, reject));
    });
  }

  chmodSync(p: PortablePath, mask: number) {
    return this.realFs.chmodSync(npath.fromPortablePath(p), mask);
  }

  async fchownPromise(fd: number, uid: number, gid: number): Promise<void> {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.fchown(fd, uid, gid, this.makeCallback(resolve, reject));
    });
  }

  fchownSync(fd: number, uid: number, gid: number): void {
    return this.realFs.fchownSync(fd, uid, gid);
  }

  async chownPromise(p: PortablePath, uid: number, gid: number) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.chown(npath.fromPortablePath(p), uid, gid, this.makeCallback(resolve, reject));
    });
  }

  chownSync(p: PortablePath, uid: number, gid: number) {
    return this.realFs.chownSync(npath.fromPortablePath(p), uid, gid);
  }

  async renamePromise(oldP: PortablePath, newP: PortablePath) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.rename(npath.fromPortablePath(oldP), npath.fromPortablePath(newP), this.makeCallback(resolve, reject));
    });
  }

  renameSync(oldP: PortablePath, newP: PortablePath) {
    return this.realFs.renameSync(npath.fromPortablePath(oldP), npath.fromPortablePath(newP));
  }

  async copyFilePromise(sourceP: PortablePath, destP: PortablePath, flags: number = 0) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.copyFile(npath.fromPortablePath(sourceP), npath.fromPortablePath(destP), flags, this.makeCallback(resolve, reject));
    });
  }

  copyFileSync(sourceP: PortablePath, destP: PortablePath, flags: number = 0) {
    return this.realFs.copyFileSync(npath.fromPortablePath(sourceP), npath.fromPortablePath(destP), flags);
  }

  async appendFilePromise(p: FSPath<PortablePath>, content: string | Uint8Array, opts?: WriteFileOptions) {
    return await new Promise<void>((resolve, reject) => {
      const fsNativePath = typeof p === `string` ? npath.fromPortablePath(p) : p;
      if (opts) {
        this.realFs.appendFile(fsNativePath, content, opts, this.makeCallback(resolve, reject));
      } else {
        this.realFs.appendFile(fsNativePath, content, this.makeCallback(resolve, reject));
      }
    });
  }

  appendFileSync(p: PortablePath, content: string | Uint8Array, opts?: WriteFileOptions) {
    const fsNativePath = typeof p === `string` ? npath.fromPortablePath(p) : p;
    if (opts) {
      this.realFs.appendFileSync(fsNativePath, content, opts);
    } else {
      this.realFs.appendFileSync(fsNativePath, content);
    }
  }

  async writeFilePromise(p: FSPath<PortablePath>, content: string | NodeJS.ArrayBufferView, opts?: WriteFileOptions) {
    return await new Promise<void>((resolve, reject) => {
      const fsNativePath = typeof p === `string` ? npath.fromPortablePath(p) : p;
      if (opts) {
        this.realFs.writeFile(fsNativePath, content, opts, this.makeCallback(resolve, reject));
      } else {
        this.realFs.writeFile(fsNativePath, content, this.makeCallback(resolve, reject));
      }
    });
  }

  writeFileSync(p: PortablePath, content: string | NodeJS.ArrayBufferView, opts?: WriteFileOptions) {
    const fsNativePath = typeof p === `string` ? npath.fromPortablePath(p) : p;
    if (opts) {
      this.realFs.writeFileSync(fsNativePath, content, opts);
    } else {
      this.realFs.writeFileSync(fsNativePath, content);
    }
  }

  async unlinkPromise(p: PortablePath) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.unlink(npath.fromPortablePath(p), this.makeCallback(resolve, reject));
    });
  }

  unlinkSync(p: PortablePath) {
    return this.realFs.unlinkSync(npath.fromPortablePath(p));
  }

  async utimesPromise(p: PortablePath, atime: Date | string | number, mtime: Date | string | number) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.utimes(npath.fromPortablePath(p), atime, mtime, this.makeCallback(resolve, reject));
    });
  }

  utimesSync(p: PortablePath, atime: Date | string | number, mtime: Date | string | number) {
    this.realFs.utimesSync(npath.fromPortablePath(p), atime, mtime);
  }

  async lutimesPromise(p: PortablePath, atime: Date | string | number, mtime: Date | string | number) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.lutimes(npath.fromPortablePath(p), atime, mtime, this.makeCallback(resolve, reject));
    });
  }

  lutimesSync(p: PortablePath, atime: Date | string | number, mtime: Date | string | number) {
    this.realFs.lutimesSync(npath.fromPortablePath(p), atime, mtime);
  }

  async mkdirPromise(p: PortablePath, opts?: MkdirOptions) {
    return await new Promise<string | undefined>((resolve, reject) => {
      this.realFs.mkdir(npath.fromPortablePath(p), opts, this.makeCallback(resolve, reject));
    });
  }

  mkdirSync(p: PortablePath, opts?: MkdirOptions): string | undefined {
    return this.realFs.mkdirSync(npath.fromPortablePath(p), opts);
  }

  async rmdirPromise(p: PortablePath, opts?: RmdirOptions) {
    return await new Promise<void>((resolve, reject) => {
      // TODO: always pass opts when min node version is 12.10+
      if (opts) {
        this.realFs.rmdir(npath.fromPortablePath(p), opts, this.makeCallback(resolve, reject));
      } else {
        this.realFs.rmdir(npath.fromPortablePath(p), this.makeCallback(resolve, reject));
      }
    });
  }

  rmdirSync(p: PortablePath, opts?: RmdirOptions) {
    return this.realFs.rmdirSync(npath.fromPortablePath(p), opts);
  }

  async rmPromise(p: PortablePath, opts?: RmOptions) {
    return await new Promise<void>((resolve, reject) => {
      // TODO: always pass opts when min node version is 12.10+
      if (opts) {
        this.realFs.rm(npath.fromPortablePath(p), opts, this.makeCallback(resolve, reject));
      } else {
        this.realFs.rm(npath.fromPortablePath(p), this.makeCallback(resolve, reject));
      }
    });
  }

  rmSync(p: PortablePath, opts?: RmOptions) {
    return this.realFs.rmSync(npath.fromPortablePath(p), opts);
  }

  async linkPromise(existingP: PortablePath, newP: PortablePath) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.link(npath.fromPortablePath(existingP), npath.fromPortablePath(newP), this.makeCallback(resolve, reject));
    });
  }

  linkSync(existingP: PortablePath, newP: PortablePath) {
    return this.realFs.linkSync(npath.fromPortablePath(existingP), npath.fromPortablePath(newP));
  }

  async symlinkPromise(target: PortablePath, p: PortablePath, type?: SymlinkType) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.symlink(npath.fromPortablePath(target.replace(/\/+$/, ``) as PortablePath), npath.fromPortablePath(p), type, this.makeCallback(resolve, reject));
    });
  }

  symlinkSync(target: PortablePath, p: PortablePath, type?: SymlinkType) {
    return this.realFs.symlinkSync(npath.fromPortablePath(target.replace(/\/+$/, ``) as PortablePath), npath.fromPortablePath(p), type);
  }

  readFilePromise(p: FSPath<PortablePath>, encoding?: null): Promise<Buffer>;
  readFilePromise(p: FSPath<PortablePath>, encoding: BufferEncoding): Promise<string>;
  readFilePromise(p: FSPath<PortablePath>, encoding?: BufferEncoding | null): Promise<Buffer | string>;
  async readFilePromise(p: FSPath<PortablePath>, encoding?: BufferEncoding | null) {
    return await new Promise<any>((resolve, reject) => {
      const fsNativePath = typeof p === `string` ? npath.fromPortablePath(p) : p;
      this.realFs.readFile(fsNativePath, encoding, this.makeCallback(resolve, reject));
    });
  }

  readFileSync(p: FSPath<PortablePath>, encoding?: null): Buffer;
  readFileSync(p: FSPath<PortablePath>, encoding: BufferEncoding): string;
  readFileSync(p: FSPath<PortablePath>, encoding?: BufferEncoding | null): Buffer | string;
  readFileSync(p: FSPath<PortablePath>, encoding?: BufferEncoding | null) {
    const fsNativePath = typeof p === `string` ? npath.fromPortablePath(p) : p;
    return this.realFs.readFileSync(fsNativePath, encoding);
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
    return await new Promise<any>((resolve, reject) => {
      if (opts) {
        if (opts.recursive && process.platform === `win32`) {
          if (opts.withFileTypes) {
            this.realFs.readdir(npath.fromPortablePath(p), opts as any, this.makeCallback<Array<Dirent<NativePath>>>(results => resolve(results.map(direntToPortable)), reject) as any);
          } else {
            this.realFs.readdir(npath.fromPortablePath(p), opts as any, this.makeCallback<Array<NativePath>>(results => resolve(results.map(npath.toPortablePath)), reject) as any);
          }
        } else {
          this.realFs.readdir(npath.fromPortablePath(p), opts as any, this.makeCallback(resolve, reject) as any);
        }
      } else {
        this.realFs.readdir(npath.fromPortablePath(p), this.makeCallback(resolve, reject));
      }
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
    if (opts) {
      if (opts.recursive && process.platform === `win32`) {
        if (opts.withFileTypes) {
          return (this.realFs.readdirSync(npath.fromPortablePath(p), opts as any) as any as Array<Dirent<NativePath>>).map(direntToPortable);
        } else {
          return (this.realFs.readdirSync(npath.fromPortablePath(p), opts as any) as any as Array<NativePath>).map(npath.toPortablePath);
        }
      } else {
        return this.realFs.readdirSync(npath.fromPortablePath(p), opts as any) as Array<PortablePath>;
      }
    } else {
      return this.realFs.readdirSync(npath.fromPortablePath(p)) as Array<PortablePath>;
    }
  }

  async readlinkPromise(p: PortablePath) {
    return await new Promise<string>((resolve, reject) => {
      this.realFs.readlink(npath.fromPortablePath(p), this.makeCallback(resolve, reject));
    }).then(path => {
      return npath.toPortablePath(path);
    });
  }

  readlinkSync(p: PortablePath) {
    return npath.toPortablePath(this.realFs.readlinkSync(npath.fromPortablePath(p)));
  }

  async truncatePromise(p: PortablePath, len?: number) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.truncate(npath.fromPortablePath(p), len, this.makeCallback(resolve, reject));
    });
  }

  truncateSync(p: PortablePath, len?: number) {
    return this.realFs.truncateSync(npath.fromPortablePath(p), len);
  }

  async ftruncatePromise(fd: number, len?: number): Promise<void> {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.ftruncate(fd, len, this.makeCallback(resolve, reject));
    });
  }

  ftruncateSync(fd: number, len?: number): void {
    return this.realFs.ftruncateSync(fd, len);
  }

  watch(p: PortablePath, cb?: WatchCallback): Watcher;
  watch(p: PortablePath, opts: WatchOptions, cb?: WatchCallback): Watcher;
  watch(p: PortablePath, a?: WatchOptions | WatchCallback, b?: WatchCallback) {
    return this.realFs.watch(
      npath.fromPortablePath(p),
      // @ts-expect-error
      a,
      b,
    );
  }

  watchFile(p: PortablePath, cb: WatchFileCallback): StatWatcher;
  watchFile(p: PortablePath, opts: WatchFileOptions, cb: WatchFileCallback): StatWatcher;
  watchFile(p: PortablePath, a: WatchFileOptions | WatchFileCallback, b?: WatchFileCallback) {
    return this.realFs.watchFile(
      npath.fromPortablePath(p),
      // @ts-expect-error
      a,
      b,
    ) as unknown as StatWatcher;
  }

  unwatchFile(p: PortablePath, cb?: WatchFileCallback) {
    return this.realFs.unwatchFile(npath.fromPortablePath(p), cb);
  }

  private makeCallback<T>(resolve: (value: T) => void, reject: (reject: NodeJS.ErrnoException) => void) {
    return (err: NodeJS.ErrnoException | null, result: T) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    };
  }
}
