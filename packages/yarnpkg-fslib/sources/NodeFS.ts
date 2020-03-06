import fs, {Stats}                                          from 'fs';

import {CreateReadStreamOptions, CreateWriteStreamOptions}  from './FakeFS';
import {Dirent, SymlinkType}                                from './FakeFS';
import {BasePortableFakeFS, WriteFileOptions}               from './FakeFS';
import {MkdirOptions, WatchOptions, WatchCallback, Watcher} from './FakeFS';
import {FSPath, PortablePath, Filename, npath}              from './path';

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

  async openPromise(p: PortablePath, flags: string, mode?: number) {
    return await new Promise<number>((resolve, reject) => {
      this.realFs.open(npath.fromPortablePath(p), flags, mode, this.makeCallback(resolve, reject));
    });
  }

  openSync(p: PortablePath, flags: string, mode?: number) {
    return this.realFs.openSync(npath.fromPortablePath(p), flags, mode);
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

  async statPromise(p: PortablePath) {
    return await new Promise<Stats>((resolve, reject) => {
      this.realFs.stat(npath.fromPortablePath(p), this.makeCallback(resolve, reject));
    });
  }

  statSync(p: PortablePath) {
    return this.realFs.statSync(npath.fromPortablePath(p));
  }

  async lstatPromise(p: PortablePath) {
    return await new Promise<Stats>((resolve, reject) => {
      this.realFs.lstat(npath.fromPortablePath(p), this.makeCallback(resolve, reject));
    });
  }

  lstatSync(p: PortablePath) {
    return this.realFs.lstatSync(npath.fromPortablePath(p));
  }

  async chmodPromise(p: PortablePath, mask: number) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.chmod(npath.fromPortablePath(p), mask, this.makeCallback(resolve, reject));
    });
  }

  chmodSync(p: PortablePath, mask: number) {
    return this.realFs.chmodSync(npath.fromPortablePath(p), mask);
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

  async appendFilePromise(p: FSPath<PortablePath>, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return await new Promise<void>((resolve, reject) => {
      const fsNativePath = typeof p === `string` ? npath.fromPortablePath(p) : p;
      if (opts) {
        this.realFs.appendFile(fsNativePath, content, opts, this.makeCallback(resolve, reject));
      } else {
        this.realFs.appendFile(fsNativePath, content, this.makeCallback(resolve, reject));
      }
    });
  }

  appendFileSync(p: PortablePath, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    const fsNativePath = typeof p === `string` ? npath.fromPortablePath(p) : p;
    if (opts) {
      this.realFs.appendFileSync(fsNativePath, content, opts);
    } else {
      this.realFs.appendFileSync(fsNativePath, content);
    }
  }

  async writeFilePromise(p: FSPath<PortablePath>, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return await new Promise<void>((resolve, reject) => {
      const fsNativePath = typeof p === `string` ? npath.fromPortablePath(p) : p;
      if (opts) {
        this.realFs.writeFile(fsNativePath, content, opts, this.makeCallback(resolve, reject));
      } else {
        this.realFs.writeFile(fsNativePath, content, this.makeCallback(resolve, reject));
      }
    });
  }

  writeFileSync(p: PortablePath, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
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

  async mkdirPromise(p: PortablePath, opts?: MkdirOptions) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.mkdir(npath.fromPortablePath(p), opts, this.makeCallback(resolve, reject));
    });
  }

  mkdirSync(p: PortablePath, opts?: MkdirOptions) {
    return this.realFs.mkdirSync(npath.fromPortablePath(p), opts);
  }

  async rmdirPromise(p: PortablePath) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.rmdir(npath.fromPortablePath(p), this.makeCallback(resolve, reject));
    });
  }

  rmdirSync(p: PortablePath) {
    return this.realFs.rmdirSync(npath.fromPortablePath(p));
  }

  async symlinkPromise(target: PortablePath, p: PortablePath, type?: SymlinkType) {
    const symlinkType: SymlinkType = type || (target.endsWith(`/`) ? `dir` : `file`);

    return await new Promise<void>((resolve, reject) => {
      this.realFs.symlink(npath.fromPortablePath(target.replace(/\/+$/, ``) as PortablePath), npath.fromPortablePath(p), symlinkType, this.makeCallback(resolve, reject));
    });
  }

  symlinkSync(target: PortablePath, p: PortablePath, type?: SymlinkType) {
    const symlinkType: SymlinkType = type || (target.endsWith(`/`) ? `dir` : `file`);

    return this.realFs.symlinkSync(npath.fromPortablePath(target.replace(/\/+$/, ``) as PortablePath), npath.fromPortablePath(p), symlinkType);
  }

  readFilePromise(p: FSPath<PortablePath>, encoding: 'utf8'): Promise<string>;
  readFilePromise(p: FSPath<PortablePath>, encoding?: string): Promise<Buffer>;
  async readFilePromise(p: FSPath<PortablePath>, encoding?: string) {
    return await new Promise<any>((resolve, reject) => {
      const fsNativePath = typeof p === `string` ? npath.fromPortablePath(p) : p;
      this.realFs.readFile(fsNativePath, encoding, this.makeCallback(resolve, reject));
    });
  }

  readFileSync(p: FSPath<PortablePath>, encoding: 'utf8'): string;
  readFileSync(p: FSPath<PortablePath>, encoding?: string): Buffer;
  readFileSync(p: FSPath<PortablePath>, encoding?: string) {
    const fsNativePath = typeof p === `string` ? npath.fromPortablePath(p) : p;
    return this.realFs.readFileSync(fsNativePath, encoding);
  }

  async readdirPromise(p: PortablePath): Promise<Array<Filename>>;
  async readdirPromise(p: PortablePath, opts: {withFileTypes: false}): Promise<Array<Filename>>;
  async readdirPromise(p: PortablePath, opts: {withFileTypes: true}): Promise<Array<Dirent>>;
  async readdirPromise(p: PortablePath, opts: {withFileTypes: boolean}): Promise<Array<Filename> | Array<Dirent>>;
  async readdirPromise(p: PortablePath, {withFileTypes}: {withFileTypes?: boolean} = {}): Promise<Array<string> | Array<Dirent>> {
    return await new Promise<Array<Filename> | Array<Dirent>>((resolve, reject) => {
      if (withFileTypes) {
        this.realFs.readdir(npath.fromPortablePath(p), {withFileTypes: true}, this.makeCallback(resolve, reject) as any);
      } else {
        this.realFs.readdir(npath.fromPortablePath(p), this.makeCallback(value => resolve(value as Filename[]), reject));
      }
    });
  }

  readdirSync(p: PortablePath): Array<Filename>;
  readdirSync(p: PortablePath, opts: {withFileTypes: false}): Array<Filename>;
  readdirSync(p: PortablePath, opts: {withFileTypes: true}): Array<Dirent>;
  readdirSync(p: PortablePath, opts: {withFileTypes: boolean}): Array<Filename> | Array<Dirent>;
  readdirSync(p: PortablePath, {withFileTypes}: {withFileTypes?: boolean} = {}): Array<string> | Array<Dirent> {
    if (withFileTypes) {
      return this.realFs.readdirSync(npath.fromPortablePath(p), {withFileTypes: true} as any);
    } else {
      return this.realFs.readdirSync(npath.fromPortablePath(p)) as Filename[];
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

  watch(p: PortablePath, cb?: WatchCallback): Watcher;
  watch(p: PortablePath, opts: WatchOptions, cb?: WatchCallback): Watcher;
  watch(p: PortablePath, a?: WatchOptions | WatchCallback, b?: WatchCallback) {
    return this.realFs.watch(
      npath.fromPortablePath(p),
      // @ts-ignore
      a,
      b,
    );
  }

  private makeCallback<T>(resolve: (value?: T) => void, reject: (reject: NodeJS.ErrnoException) => void) {
    return (err: NodeJS.ErrnoException | null, result?: T) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    };
  }
}
