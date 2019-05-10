import fs, {Stats}                                         from 'fs';

import {CreateReadStreamOptions, CreateWriteStreamOptions} from './FakeFS';
import {FakeFS, WriteFileOptions}                          from './FakeFS';

const WINDOWS_PATH_REGEXP = /^[a-zA-Z]:.*$/;
const PORTABLE_PATH_REGEXP = /^\/[a-zA-Z]:.*$/;

export class NodeFS extends FakeFS {
  private readonly realFs: typeof fs;

  constructor(realFs: typeof fs = fs) {
    super();

    this.realFs = realFs;
  }

  getRealPath() {
    return `/`;
  }

  async openPromise(p: string, flags: string, mode?: number) {
    return await new Promise<number>((resolve, reject) => {
      this.realFs.open(NodeFS.fromPortablePath(p), flags, mode, this.makeCallback(resolve, reject));
    });
  }

  openSync(p: string, flags: string, mode?: number) {
    return this.realFs.openSync(NodeFS.fromPortablePath(p), flags, mode);
  }

  async closePromise(fd: number) {
    await new Promise<void>((resolve, reject) => {
      this.realFs.close(fd, this.makeCallback(resolve, reject));
    });
  }

  closeSync(fd: number) {
    this.realFs.closeSync(fd);
  }

  createReadStream(p: string, opts?: CreateReadStreamOptions) {
    return this.realFs.createReadStream(NodeFS.fromPortablePath(p), opts);
  }

  createWriteStream(p: string, opts?: CreateWriteStreamOptions) {
    return this.realFs.createWriteStream(NodeFS.fromPortablePath(p), opts);
  }

  async realpathPromise(p: string) {
    return await new Promise<string>((resolve, reject) => {
      this.realFs.realpath(NodeFS.fromPortablePath(p), {}, this.makeCallback(resolve, reject));
    }).then(path => {
      return NodeFS.toPortablePath(path);
    });
  }

  realpathSync(p: string) {
    return NodeFS.toPortablePath(this.realFs.realpathSync(NodeFS.fromPortablePath(p), {}));
  }

  async existsPromise(p: string) {
    return await new Promise<boolean>(resolve => {
      this.realFs.exists(NodeFS.fromPortablePath(p), resolve);
    });
  }

  accessSync(p: string, mode?: number) {
    return this.realFs.accessSync(NodeFS.fromPortablePath(p), mode);
  }

  async accessPromise(p: string, mode?: number) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.access(NodeFS.fromPortablePath(p), mode, this.makeCallback(resolve, reject));
    });
  }

  existsSync(p: string) {
    return this.realFs.existsSync(NodeFS.fromPortablePath(p));
  }

  async statPromise(p: string) {
    return await new Promise<Stats>((resolve, reject) => {
      this.realFs.stat(NodeFS.fromPortablePath(p), this.makeCallback(resolve, reject));
    });
  }

  statSync(p: string) {
    return this.realFs.statSync(NodeFS.fromPortablePath(p));
  }

  async lstatPromise(p: string) {
    return await new Promise<Stats>((resolve, reject) => {
      this.realFs.lstat(NodeFS.fromPortablePath(p), this.makeCallback(resolve, reject));
    });
  }

  lstatSync(p: string) {
    return this.realFs.lstatSync(NodeFS.fromPortablePath(p));
  }

  async chmodPromise(p: string, mask: number) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.chmod(NodeFS.fromPortablePath(p), mask, this.makeCallback(resolve, reject));
    });
  }

  chmodSync(p: string, mask: number) {
    return this.realFs.chmodSync(NodeFS.fromPortablePath(p), mask);
  }

  async renamePromise(oldP: string, newP: string) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.rename(NodeFS.fromPortablePath(oldP), NodeFS.fromPortablePath(newP), this.makeCallback(resolve, reject));
    });
  }

  renameSync(oldP: string, newP: string) {
    return this.realFs.renameSync(NodeFS.fromPortablePath(oldP), NodeFS.fromPortablePath(newP));
  }

  async copyFilePromise(sourceP: string, destP: string, flags: number = 0) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.copyFile(NodeFS.fromPortablePath(sourceP), NodeFS.fromPortablePath(destP), flags, this.makeCallback(resolve, reject));
    });
  }

  copyFileSync(sourceP: string, destP: string, flags: number = 0) {
    return this.realFs.copyFileSync(NodeFS.fromPortablePath(sourceP), NodeFS.fromPortablePath(destP), flags);
  }

  async writeFilePromise(p: string, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return await new Promise<void>((resolve, reject) => {
      if (opts) {
        this.realFs.writeFile(NodeFS.fromPortablePath(p), content, opts, this.makeCallback(resolve, reject));
      } else {
        this.realFs.writeFile(NodeFS.fromPortablePath(p), content, this.makeCallback(resolve, reject));
      }
    });
  }

  writeFileSync(p: string, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    if (opts) {
      this.realFs.writeFileSync(NodeFS.fromPortablePath(p), content, opts);
    } else {
      this.realFs.writeFileSync(NodeFS.fromPortablePath(p), content);
    }
  }

  async unlinkPromise(p: string) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.unlink(NodeFS.fromPortablePath(p), this.makeCallback(resolve, reject));
    });
  }

  unlinkSync(p: string) {
    return this.realFs.unlinkSync(NodeFS.fromPortablePath(p));
  }

  async utimesPromise(p: string, atime: Date | string | number, mtime: Date | string | number) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.utimes(NodeFS.fromPortablePath(p), atime, mtime, this.makeCallback(resolve, reject));
    });
  }

  utimesSync(p: string, atime: Date | string | number, mtime: Date | string | number) {
    this.realFs.utimesSync(NodeFS.fromPortablePath(p), atime, mtime);
  }

  async mkdirPromise(p: string) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.mkdir(NodeFS.fromPortablePath(p), this.makeCallback(resolve, reject));
    });
  }

  mkdirSync(p: string) {
    return this.realFs.mkdirSync(NodeFS.fromPortablePath(p));
  }

  async rmdirPromise(p: string) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.rmdir(NodeFS.fromPortablePath(p), this.makeCallback(resolve, reject));
    });
  }

  rmdirSync(p: string) {
    return this.realFs.rmdirSync(NodeFS.fromPortablePath(p));
  }

  async symlinkPromise(target: string, p: string) {
    const type: 'dir' | 'file' = target.endsWith(`/`) ? `dir` : `file`;

    return await new Promise<void>((resolve, reject) => {
      this.realFs.symlink(NodeFS.fromPortablePath(target.replace(/\/+$/, ``)), NodeFS.fromPortablePath(p), type, this.makeCallback(resolve, reject));
    });
  }

  symlinkSync(target: string, p: string) {
    const type: 'dir' | 'file' = target.endsWith(`/`) ? `dir` : `file`;

    return this.realFs.symlinkSync(NodeFS.fromPortablePath(target.replace(/\/+$/, ``)), NodeFS.fromPortablePath(p), type);
  }

  readFilePromise(p: string, encoding: 'utf8'): Promise<string>;
  readFilePromise(p: string, encoding?: string): Promise<Buffer>;
  async readFilePromise(p: string, encoding?: string) {
    return await new Promise<any>((resolve, reject) => {
      this.realFs.readFile(NodeFS.fromPortablePath(p), encoding, this.makeCallback(resolve, reject));
    });
  }

  readFileSync(p: string, encoding: 'utf8'): string;
  readFileSync(p: string, encoding?: string): Buffer;
  readFileSync(p: string, encoding?: string) {
    return this.realFs.readFileSync(NodeFS.fromPortablePath(p), encoding);
  }

  async readdirPromise(p: string) {
    return await new Promise<Array<string>>((resolve, reject) => {
      this.realFs.readdir(NodeFS.fromPortablePath(p), this.makeCallback(resolve, reject));
    });
  }

  readdirSync(p: string) {
    return this.realFs.readdirSync(NodeFS.fromPortablePath(p));
  }

  async readlinkPromise(p: string) {
    return await new Promise<string>((resolve, reject) => {
      this.realFs.readlink(NodeFS.fromPortablePath(p), this.makeCallback(resolve, reject));
    }).then(path => {
      return NodeFS.toPortablePath(path);
    });
  }

  readlinkSync(p: string) {
    return NodeFS.toPortablePath(this.realFs.readlinkSync(NodeFS.fromPortablePath(p)));
  }

  private makeCallback<T>(resolve: (value?: T) => void, reject: (reject: Error) => void) {
    return (err: Error, result?: T) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    };
  }

  // Path should look like "/N:/berry/scripts/plugin-pack.js"
  // And transform to "N:\berry\scripts\plugin-pack.js"
  static fromPortablePath(p: string) {
    if (process.platform !== 'win32')
      return p;

    return p.match(PORTABLE_PATH_REGEXP) ? p.substring(1).replace(/\//g, `\\`) : p;
  }

  // Path should look like "N:/berry/scripts/plugin-pack.js"
  // And transform to "/N:/berry/scripts/plugin-pack.js"
  static toPortablePath(p: string) {
    if (process.platform !== 'win32')
      return p;

    return (p.match(WINDOWS_PATH_REGEXP) ? `/${p}` : p).replace(/\\/g, `/`);
  }
}
