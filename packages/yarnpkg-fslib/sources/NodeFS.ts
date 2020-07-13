import fs, {Stats}                                              from 'fs';

import {CreateReadStreamOptions, CreateWriteStreamOptions}      from './FakeFS';
import {Dirent, SymlinkType}                                    from './FakeFS';
import {BasePortableFakeFS, WriteFileOptions}                   from './FakeFS';
import {MkdirOptions, WatchOptions, WatchCallback, Watcher}     from './FakeFS';
import {ENOSYS}                                                 from './errors';
import {FSPath, PortablePath, Filename, ppath, npath, PathLike} from './path';

export class NodeFS extends BasePortableFakeFS {
  private readonly realFs: typeof fs;

  constructor(realFs: typeof fs = fs) {
    super();

    this.realFs = realFs;

    // @ts-ignore
    if (typeof this.realFs.lutimes !== `undefined`) {
      this.lutimesPromise = this.lutimesPromiseImpl;
      this.lutimesSync = this.lutimesSyncImpl;
    }
  }

  getExtractHint() {
    return false;
  }

  getRealPath() {
    return PortablePath.root;
  }

  resolve(p: PathLike<PortablePath>) {
    return ppath.resolve(ppath.fromPathLike(p));
  }

  async openPromise(p: PathLike<PortablePath>, flags: string, mode?: number) {
    return await new Promise<number>((resolve, reject) => {
      this.realFs.open(npath.fromPortablePath(ppath.fromPathLike(p)), flags, mode, this.makeCallback(resolve, reject));
    });
  }

  openSync(p: PathLike<PortablePath>, flags: string, mode?: number) {
    return this.realFs.openSync(npath.fromPortablePath(ppath.fromPathLike(p)), flags, mode);
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

  createReadStream(p: PathLike<PortablePath> | null, opts?: CreateReadStreamOptions) {
    const realPath = (p !== null ? npath.fromPortablePath(ppath.fromPathLike(p)) : p) as fs.PathLike;
    return this.realFs.createReadStream(realPath, opts);
  }

  createWriteStream(p: PathLike<PortablePath> | null, opts?: CreateWriteStreamOptions) {
    const realPath = (p !== null ? npath.fromPortablePath(ppath.fromPathLike(p)) : p) as fs.PathLike;
    return this.realFs.createWriteStream(realPath, opts);
  }

  async realpathPromise(p: PathLike<PortablePath>) {
    return await new Promise<string>((resolve, reject) => {
      this.realFs.realpath(npath.fromPortablePath(ppath.fromPathLike(p)), {}, this.makeCallback(resolve, reject));
    }).then(path => {
      return npath.toPortablePath(path);
    });
  }

  realpathSync(p: PathLike<PortablePath>) {
    return npath.toPortablePath(this.realFs.realpathSync(npath.fromPortablePath(ppath.fromPathLike(p)), {}));
  }

  async existsPromise(p: PathLike<PortablePath>) {
    return await new Promise<boolean>(resolve => {
      this.realFs.exists(npath.fromPortablePath(ppath.fromPathLike(p)), resolve);
    });
  }

  accessSync(p: PathLike<PortablePath>, mode?: number) {
    return this.realFs.accessSync(npath.fromPortablePath(ppath.fromPathLike(p)), mode);
  }

  async accessPromise(p: PathLike<PortablePath>, mode?: number) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.access(npath.fromPortablePath(ppath.fromPathLike(p)), mode, this.makeCallback(resolve, reject));
    });
  }

  existsSync(p: PathLike<PortablePath>) {
    return this.realFs.existsSync(npath.fromPortablePath(ppath.fromPathLike(p)));
  }

  async statPromise(p: PathLike<PortablePath>) {
    return await new Promise<Stats>((resolve, reject) => {
      this.realFs.stat(npath.fromPortablePath(ppath.fromPathLike(p)), this.makeCallback(resolve, reject));
    });
  }

  statSync(p: PathLike<PortablePath>) {
    return this.realFs.statSync(npath.fromPortablePath(ppath.fromPathLike(p)));
  }

  async lstatPromise(p: PathLike<PortablePath>) {
    return await new Promise<Stats>((resolve, reject) => {
      this.realFs.lstat(npath.fromPortablePath(ppath.fromPathLike(p)), this.makeCallback(resolve, reject));
    });
  }

  lstatSync(p: PathLike<PortablePath>) {
    return this.realFs.lstatSync(npath.fromPortablePath(ppath.fromPathLike(p)));
  }

  async chmodPromise(p: PathLike<PortablePath>, mask: number) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.chmod(npath.fromPortablePath(ppath.fromPathLike(p)), mask, this.makeCallback(resolve, reject));
    });
  }

  chmodSync(p: PathLike<PortablePath>, mask: number) {
    return this.realFs.chmodSync(npath.fromPortablePath(ppath.fromPathLike(p)), mask);
  }

  async renamePromise(oldP: PathLike<PortablePath>, newP: PathLike<PortablePath>) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.rename(
        npath.fromPortablePath(ppath.fromPathLike(oldP)),
        npath.fromPortablePath(ppath.fromPathLike(newP)),
        this.makeCallback(resolve, reject),
      );
    });
  }

  renameSync(oldP: PathLike<PortablePath>, newP: PathLike<PortablePath>) {
    return this.realFs.renameSync(
      npath.fromPortablePath(ppath.fromPathLike(oldP)),
      npath.fromPortablePath(ppath.fromPathLike(newP)),
    );
  }

  async copyFilePromise(sourceP: PathLike<PortablePath>, destP: PathLike<PortablePath>, flags: number = 0) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.copyFile(
        npath.fromPortablePath(ppath.fromPathLike(sourceP)),
        npath.fromPortablePath(ppath.fromPathLike(destP)),
        flags,
        this.makeCallback(resolve, reject),
      );
    });
  }

  copyFileSync(sourceP: PathLike<PortablePath>, destP: PathLike<PortablePath>, flags: number = 0) {
    return this.realFs.copyFileSync(
      npath.fromPortablePath(ppath.fromPathLike(sourceP)),
      npath.fromPortablePath(ppath.fromPathLike(destP)),
      flags,
    );
  }

  async appendFilePromise(p: FSPath<PortablePath>, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return await new Promise<void>((resolve, reject) => {
      const fsNativePath = PathLike.isPathLike(p)
        ? npath.fromPortablePath(ppath.fromPathLike(p))
        : p;
      if (opts) {
        this.realFs.appendFile(fsNativePath, content, opts, this.makeCallback(resolve, reject));
      } else {
        this.realFs.appendFile(fsNativePath, content, this.makeCallback(resolve, reject));
      }
    });
  }

  appendFileSync(p: FSPath<PortablePath>, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    const fsNativePath = PathLike.isPathLike(p)
      ? npath.fromPortablePath(ppath.fromPathLike(p))
      : p;
    if (opts) {
      this.realFs.appendFileSync(fsNativePath, content, opts);
    } else {
      this.realFs.appendFileSync(fsNativePath, content);
    }
  }

  async writeFilePromise(p: FSPath<PortablePath>, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return await new Promise<void>((resolve, reject) => {
      const fsNativePath = PathLike.isPathLike(p)
        ? npath.fromPortablePath(ppath.fromPathLike(p))
        : p;
      if (opts) {
        this.realFs.writeFile(fsNativePath, content, opts, this.makeCallback(resolve, reject));
      } else {
        this.realFs.writeFile(fsNativePath, content, this.makeCallback(resolve, reject));
      }
    });
  }

  writeFileSync(p: FSPath<PortablePath>, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    const fsNativePath = PathLike.isPathLike(p)
      ? npath.fromPortablePath(ppath.fromPathLike(p))
      : p;
    if (opts) {
      this.realFs.writeFileSync(fsNativePath, content, opts);
    } else {
      this.realFs.writeFileSync(fsNativePath, content);
    }
  }

  async unlinkPromise(p: PathLike<PortablePath>) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.unlink(npath.fromPortablePath(ppath.fromPathLike(p)), this.makeCallback(resolve, reject));
    });
  }

  unlinkSync(p: PathLike<PortablePath>) {
    return this.realFs.unlinkSync(npath.fromPortablePath(ppath.fromPathLike(p)));
  }

  async utimesPromise(p: PathLike<PortablePath>, atime: Date | string | number, mtime: Date | string | number) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.utimes(npath.fromPortablePath(ppath.fromPathLike(p)), atime, mtime, this.makeCallback(resolve, reject));
    });
  }

  utimesSync(p: PathLike<PortablePath>, atime: Date | string | number, mtime: Date | string | number) {
    this.realFs.utimesSync(npath.fromPortablePath(ppath.fromPathLike(p)), atime, mtime);
  }

  private async lutimesPromiseImpl(this: NodeFS, p: PathLike<PortablePath>, atime: Date | string | number, mtime: Date | string | number) {
    // @ts-ignore: Not yet in DefinitelyTyped
    const lutimes = this.realFs.lutimes;
    if (typeof lutimes === `undefined`)
      throw ENOSYS(`unavailable Node binding`, `lutimes '${p}'`);

    return await new Promise<void>((resolve, reject) => {
      lutimes.call(this.realFs, npath.fromPortablePath(ppath.fromPathLike(p)), atime, mtime, this.makeCallback(resolve, reject));
    });
  }

  private lutimesSyncImpl(this: NodeFS, p: PathLike<PortablePath>, atime: Date | string | number, mtime: Date | string | number) {
    // @ts-ignore: Not yet in DefinitelyTyped
    const lutimesSync = this.realFs.lutimesSync;
    if (typeof lutimesSync === `undefined`)
      throw ENOSYS(`unavailable Node binding`, `lutimes '${p}'`);

    lutimesSync.call(this.realFs, npath.fromPortablePath(ppath.fromPathLike(p)), atime, mtime);
  }

  async mkdirPromise(p: PathLike<PortablePath>, opts?: MkdirOptions) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.mkdir(npath.fromPortablePath(ppath.fromPathLike(p)), opts, this.makeCallback(resolve, reject));
    });
  }

  mkdirSync(p: PathLike<PortablePath>, opts?: MkdirOptions) {
    return this.realFs.mkdirSync(npath.fromPortablePath(ppath.fromPathLike(p)), opts);
  }

  async rmdirPromise(p: PathLike<PortablePath>) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.rmdir(npath.fromPortablePath(ppath.fromPathLike(p)), this.makeCallback(resolve, reject));
    });
  }

  rmdirSync(p: PathLike<PortablePath>) {
    return this.realFs.rmdirSync(npath.fromPortablePath(ppath.fromPathLike(p)));
  }

  async symlinkPromise(target: PathLike<PortablePath>, p: PathLike<PortablePath>, type?: SymlinkType) {
    const targetPath = ppath.fromPathLike(target);

    const symlinkType: SymlinkType = type || (targetPath.endsWith(`/`) ? `dir` : `file`);

    return await new Promise<void>((resolve, reject) => {
      this.realFs.symlink(npath.fromPortablePath(targetPath.replace(/\/+$/, ``) as PortablePath), npath.fromPortablePath(ppath.fromPathLike(p)), symlinkType, this.makeCallback(resolve, reject));
    });
  }

  symlinkSync(target: PathLike<PortablePath>, p: PathLike<PortablePath>, type?: SymlinkType) {
    const targetPath = ppath.fromPathLike(target);

    const symlinkType: SymlinkType = type || (targetPath.endsWith(`/`) ? `dir` : `file`);

    return this.realFs.symlinkSync(npath.fromPortablePath(targetPath.replace(/\/+$/, ``) as PortablePath), npath.fromPortablePath(ppath.fromPathLike(p)), symlinkType);
  }

  readFilePromise(p: FSPath<PortablePath>, encoding: 'utf8'): Promise<string>;
  readFilePromise(p: FSPath<PortablePath>, encoding?: string): Promise<Buffer>;
  async readFilePromise(p: FSPath<PortablePath>, encoding?: string) {
    return await new Promise<any>((resolve, reject) => {
      const fsNativePath = PathLike.isPathLike(p)
        ? npath.fromPortablePath(ppath.fromPathLike(p))
        : p;
      this.realFs.readFile(fsNativePath, encoding, this.makeCallback(resolve, reject));
    });
  }

  readFileSync(p: FSPath<PortablePath>, encoding: 'utf8'): string;
  readFileSync(p: FSPath<PortablePath>, encoding?: string): Buffer;
  readFileSync(p: FSPath<PortablePath>, encoding?: string) {
    const fsNativePath = PathLike.isPathLike(p)
      ? npath.fromPortablePath(ppath.fromPathLike(p))
      : p;
    return this.realFs.readFileSync(fsNativePath, encoding);
  }

  async readdirPromise(p: PathLike<PortablePath>): Promise<Array<Filename>>;
  async readdirPromise(p: PathLike<PortablePath>, opts: {withFileTypes: false}): Promise<Array<Filename>>;
  async readdirPromise(p: PathLike<PortablePath>, opts: {withFileTypes: true}): Promise<Array<Dirent>>;
  async readdirPromise(p: PathLike<PortablePath>, opts: {withFileTypes: boolean}): Promise<Array<Filename> | Array<Dirent>>;
  async readdirPromise(p: PathLike<PortablePath>, {withFileTypes}: {withFileTypes?: boolean} = {}): Promise<Array<string> | Array<Dirent>> {
    return await new Promise<Array<Filename> | Array<Dirent>>((resolve, reject) => {
      if (withFileTypes) {
        this.realFs.readdir(npath.fromPortablePath(ppath.fromPathLike(p)), {withFileTypes: true}, this.makeCallback(resolve, reject) as any);
      } else {
        this.realFs.readdir(npath.fromPortablePath(ppath.fromPathLike(p)), this.makeCallback(value => resolve(value as Array<Filename>), reject));
      }
    });
  }

  readdirSync(p: PathLike<PortablePath>): Array<Filename>;
  readdirSync(p: PathLike<PortablePath>, opts: {withFileTypes: false}): Array<Filename>;
  readdirSync(p: PathLike<PortablePath>, opts: {withFileTypes: true}): Array<Dirent>;
  readdirSync(p: PathLike<PortablePath>, opts: {withFileTypes: boolean}): Array<Filename> | Array<Dirent>;
  readdirSync(p: PathLike<PortablePath>, {withFileTypes}: {withFileTypes?: boolean} = {}): Array<string> | Array<Dirent> {
    if (withFileTypes) {
      return this.realFs.readdirSync(npath.fromPortablePath(ppath.fromPathLike(p)), {withFileTypes: true} as any);
    } else {
      return this.realFs.readdirSync(npath.fromPortablePath(ppath.fromPathLike(p))) as Array<Filename>;
    }
  }

  async readlinkPromise(p: PathLike<PortablePath>) {
    return await new Promise<string>((resolve, reject) => {
      this.realFs.readlink(npath.fromPortablePath(ppath.fromPathLike(p)), this.makeCallback(resolve, reject));
    }).then(path => {
      return npath.toPortablePath(path);
    });
  }

  readlinkSync(p: PathLike<PortablePath>) {
    return npath.toPortablePath(this.realFs.readlinkSync(npath.fromPortablePath(ppath.fromPathLike(p))));
  }

  watch(p: PathLike<PortablePath>, cb?: WatchCallback): Watcher;
  watch(p: PathLike<PortablePath>, opts: WatchOptions, cb?: WatchCallback): Watcher;
  watch(p: PathLike<PortablePath>, a?: WatchOptions | WatchCallback, b?: WatchCallback) {
    return this.realFs.watch(
      npath.fromPortablePath(ppath.fromPathLike(p)),
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
