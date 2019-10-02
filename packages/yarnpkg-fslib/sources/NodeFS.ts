import fs, {Stats}                                         from 'fs';

import {CreateReadStreamOptions, CreateWriteStreamOptions} from './FakeFS';
import {BasePortableFakeFS, WriteFileOptions}              from './FakeFS';
import {WatchOptions, WatchCallback, Watcher}              from './FakeFS';
import {FSPath, PortablePath, NativePath, Filename, Path}  from './path';
import {fromPortablePath, toPortablePath}                  from './path';

export class NodeFS extends BasePortableFakeFS {
  private readonly realFs: typeof fs;

  constructor(realFs: typeof fs = fs) {
    super();

    this.realFs = realFs;
  }

  getRealPath() {
    return PortablePath.root;
  }

  async openPromise(p: PortablePath, flags: string, mode?: number) {
    return await new Promise<number>((resolve, reject) => {
      this.realFs.open(NodeFS.fromPortablePath(p), flags, mode, this.makeCallback(resolve, reject));
    });
  }

  openSync(p: PortablePath, flags: string, mode?: number) {
    return this.realFs.openSync(NodeFS.fromPortablePath(p), flags, mode);
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
    const realPath = (p !== null ? NodeFS.fromPortablePath(p) : p) as fs.PathLike;
    return this.realFs.createReadStream(realPath, opts);
  }

  createWriteStream(p: PortablePath | null, opts?: CreateWriteStreamOptions) {
    const realPath = (p !== null ? NodeFS.fromPortablePath(p) : p) as fs.PathLike;
    return this.realFs.createWriteStream(realPath, opts);
  }

  async realpathPromise(p: PortablePath) {
    return await new Promise<string>((resolve, reject) => {
      this.realFs.realpath(NodeFS.fromPortablePath(p), {}, this.makeCallback(resolve, reject));
    }).then(path => {
      return NodeFS.toPortablePath(path);
    });
  }

  realpathSync(p: PortablePath) {
    return NodeFS.toPortablePath(this.realFs.realpathSync(NodeFS.fromPortablePath(p), {}));
  }

  async existsPromise(p: PortablePath) {
    return await new Promise<boolean>(resolve => {
      this.realFs.exists(NodeFS.fromPortablePath(p), resolve);
    });
  }

  accessSync(p: PortablePath, mode?: number) {
    return this.realFs.accessSync(NodeFS.fromPortablePath(p), mode);
  }

  async accessPromise(p: PortablePath, mode?: number) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.access(NodeFS.fromPortablePath(p), mode, this.makeCallback(resolve, reject));
    });
  }

  existsSync(p: PortablePath) {
    return this.realFs.existsSync(NodeFS.fromPortablePath(p));
  }

  async statPromise(p: PortablePath) {
    return await new Promise<Stats>((resolve, reject) => {
      this.realFs.stat(NodeFS.fromPortablePath(p), this.makeCallback(resolve, reject));
    });
  }

  statSync(p: PortablePath) {
    return this.realFs.statSync(NodeFS.fromPortablePath(p));
  }

  async lstatPromise(p: PortablePath) {
    return await new Promise<Stats>((resolve, reject) => {
      this.realFs.lstat(NodeFS.fromPortablePath(p), this.makeCallback(resolve, reject));
    });
  }

  lstatSync(p: PortablePath) {
    return this.realFs.lstatSync(NodeFS.fromPortablePath(p));
  }

  async chmodPromise(p: PortablePath, mask: number) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.chmod(NodeFS.fromPortablePath(p), mask, this.makeCallback(resolve, reject));
    });
  }

  chmodSync(p: PortablePath, mask: number) {
    return this.realFs.chmodSync(NodeFS.fromPortablePath(p), mask);
  }

  async renamePromise(oldP: PortablePath, newP: PortablePath) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.rename(NodeFS.fromPortablePath(oldP), NodeFS.fromPortablePath(newP), this.makeCallback(resolve, reject));
    });
  }

  renameSync(oldP: PortablePath, newP: PortablePath) {
    return this.realFs.renameSync(NodeFS.fromPortablePath(oldP), NodeFS.fromPortablePath(newP));
  }

  async copyFilePromise(sourceP: PortablePath, destP: PortablePath, flags: number = 0) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.copyFile(NodeFS.fromPortablePath(sourceP), NodeFS.fromPortablePath(destP), flags, this.makeCallback(resolve, reject));
    });
  }

  copyFileSync(sourceP: PortablePath, destP: PortablePath, flags: number = 0) {
    return this.realFs.copyFileSync(NodeFS.fromPortablePath(sourceP), NodeFS.fromPortablePath(destP), flags);
  }

  async appendFilePromise(p: FSPath<PortablePath>, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return await new Promise<void>((resolve, reject) => {
      const fsNativePath = typeof p === `string` ? NodeFS.fromPortablePath(p) : p;
      if (opts) {
        this.realFs.appendFile(fsNativePath, content, opts, this.makeCallback(resolve, reject));
      } else {
        this.realFs.appendFile(fsNativePath, content, this.makeCallback(resolve, reject));
      }
    });
  }

  appendFileSync(p: PortablePath, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    const fsNativePath = typeof p === `string` ? NodeFS.fromPortablePath(p) : p;
    if (opts) {
      this.realFs.appendFileSync(fsNativePath, content, opts);
    } else {
      this.realFs.appendFileSync(fsNativePath, content);
    }
  }

  async writeFilePromise(p: FSPath<PortablePath>, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return await new Promise<void>((resolve, reject) => {
      const fsNativePath = typeof p === `string` ? NodeFS.fromPortablePath(p) : p;
      if (opts) {
        this.realFs.writeFile(fsNativePath, content, opts, this.makeCallback(resolve, reject));
      } else {
        this.realFs.writeFile(fsNativePath, content, this.makeCallback(resolve, reject));
      }
    });
  }

  writeFileSync(p: PortablePath, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    const fsNativePath = typeof p === `string` ? NodeFS.fromPortablePath(p) : p;
    if (opts) {
      this.realFs.writeFileSync(fsNativePath, content, opts);
    } else {
      this.realFs.writeFileSync(fsNativePath, content);
    }
  }

  async unlinkPromise(p: PortablePath) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.unlink(NodeFS.fromPortablePath(p), this.makeCallback(resolve, reject));
    });
  }

  unlinkSync(p: PortablePath) {
    return this.realFs.unlinkSync(NodeFS.fromPortablePath(p));
  }

  async utimesPromise(p: PortablePath, atime: Date | string | number, mtime: Date | string | number) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.utimes(NodeFS.fromPortablePath(p), atime, mtime, this.makeCallback(resolve, reject));
    });
  }

  utimesSync(p: PortablePath, atime: Date | string | number, mtime: Date | string | number) {
    this.realFs.utimesSync(NodeFS.fromPortablePath(p), atime, mtime);
  }

  async mkdirPromise(p: PortablePath) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.mkdir(NodeFS.fromPortablePath(p), this.makeCallback(resolve, reject));
    });
  }

  mkdirSync(p: PortablePath) {
    return this.realFs.mkdirSync(NodeFS.fromPortablePath(p));
  }

  async rmdirPromise(p: PortablePath) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.rmdir(NodeFS.fromPortablePath(p), this.makeCallback(resolve, reject));
    });
  }

  rmdirSync(p: PortablePath) {
    return this.realFs.rmdirSync(NodeFS.fromPortablePath(p));
  }

  async symlinkPromise(target: PortablePath, p: PortablePath) {
    const type: 'dir' | 'file' = target.endsWith(`/`) ? `dir` : `file`;

    return await new Promise<void>((resolve, reject) => {
      this.realFs.symlink(NodeFS.fromPortablePath(target.replace(/\/+$/, ``) as PortablePath), NodeFS.fromPortablePath(p), type, this.makeCallback(resolve, reject));
    });
  }

  symlinkSync(target: PortablePath, p: PortablePath) {
    const type: 'dir' | 'file' = target.endsWith(`/`) ? `dir` : `file`;

    return this.realFs.symlinkSync(NodeFS.fromPortablePath(target.replace(/\/+$/, ``) as PortablePath), NodeFS.fromPortablePath(p), type);
  }

  readFilePromise(p: FSPath<PortablePath>, encoding: 'utf8'): Promise<string>;
  readFilePromise(p: FSPath<PortablePath>, encoding?: string): Promise<Buffer>;
  async readFilePromise(p: FSPath<PortablePath>, encoding?: string) {
    return await new Promise<any>((resolve, reject) => {
      const fsNativePath = typeof p === `string` ? NodeFS.fromPortablePath(p) : p;
      this.realFs.readFile(fsNativePath, encoding, this.makeCallback(resolve, reject));
    });
  }

  readFileSync(p: FSPath<PortablePath>, encoding: 'utf8'): string;
  readFileSync(p: FSPath<PortablePath>, encoding?: string): Buffer;
  readFileSync(p: FSPath<PortablePath>, encoding?: string) {
    const fsNativePath = typeof p === `string` ? NodeFS.fromPortablePath(p) : p;
    return this.realFs.readFileSync(fsNativePath, encoding);
  }

  async readdirPromise(p: PortablePath) {
    return await new Promise<Array<string>>((resolve, reject) => {
      this.realFs.readdir(NodeFS.fromPortablePath(p), this.makeCallback(resolve, reject));
    }) as Filename[];
  }

  readdirSync(p: PortablePath) {
    return this.realFs.readdirSync(NodeFS.fromPortablePath(p)) as Filename[];
  }

  async readlinkPromise(p: PortablePath) {
    return await new Promise<string>((resolve, reject) => {
      this.realFs.readlink(NodeFS.fromPortablePath(p), this.makeCallback(resolve, reject));
    }).then(path => {
      return NodeFS.toPortablePath(path);
    });
  }

  readlinkSync(p: PortablePath) {
    return NodeFS.toPortablePath(this.realFs.readlinkSync(NodeFS.fromPortablePath(p)));
  }

  watch(p: PortablePath, cb?: WatchCallback): Watcher;
  watch(p: PortablePath, opts: WatchOptions, cb?: WatchCallback): Watcher;
  watch(p: PortablePath, a?: WatchOptions | WatchCallback, b?: WatchCallback) {
    return this.realFs.watch(
      NodeFS.fromPortablePath(p),
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

  static fromPortablePath(p: Path): NativePath {
    return fromPortablePath(p);
  }

  static toPortablePath(p: Path): PortablePath {
    return toPortablePath(p);
  }
}
