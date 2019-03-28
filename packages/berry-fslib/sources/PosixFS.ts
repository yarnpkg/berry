import {posix}                                             from 'path';

import {CreateReadStreamOptions, CreateWriteStreamOptions} from './FakeFS';
import {FakeFS, WriteFileOptions}                          from './FakeFS';
import {NodeFS}                                            from './NodeFS';

export class PosixFS extends FakeFS {
  private readonly baseFs: FakeFS;

  constructor(baseFs: FakeFS) {
    super();

    this.baseFs = baseFs;
  }

  getRealPath() {
    return NodeFS.fromPortablePath(this.baseFs.getRealPath());
  }

  async openPromise(p: string, flags: string, mode?: number) {
    return await this.baseFs.openPromise(NodeFS.toPortablePath(p), flags, mode);
  }

  openSync(p: string, flags: string, mode?: number) {
    return this.baseFs.openSync(NodeFS.toPortablePath(p), flags, mode);
  }

  async closePromise(fd: number) {
    await this.baseFs.closePromise(fd);
  }

  closeSync(fd: number) {
    this.baseFs.closeSync(fd);
  }

  createReadStream(p: string, opts?: CreateReadStreamOptions) {
    return this.baseFs.createReadStream(NodeFS.toPortablePath(p), opts);
  }

  createWriteStream(p: string, opts?: CreateWriteStreamOptions) {
    return this.baseFs.createWriteStream(NodeFS.toPortablePath(p), opts);
  }

  async realpathPromise(p: string) {
    return NodeFS.fromPortablePath(await this.baseFs.realpathPromise(NodeFS.toPortablePath(p)));
  }

  realpathSync(p: string) {
    return NodeFS.fromPortablePath(this.baseFs.realpathSync(NodeFS.toPortablePath(p)));
  }

  async existsPromise(p: string) {
    return await this.baseFs.existsPromise(NodeFS.toPortablePath(p));
  }

  existsSync(p: string) {
    return this.baseFs.existsSync(NodeFS.toPortablePath(p));
  }

  async accessPromise(p: string, mode?: number) {
    return await this.baseFs.accessPromise(NodeFS.toPortablePath(p), mode);
  }

  accessSync(p: string, mode?: number) {
    return this.baseFs.accessSync(NodeFS.toPortablePath(p), mode);
  }

  async statPromise(p: string) {
    return await this.baseFs.statPromise(NodeFS.toPortablePath(p));
  }

  statSync(p: string) {
    return this.baseFs.statSync(NodeFS.toPortablePath(p));
  }

  async lstatPromise(p: string) {
    return await this.baseFs.lstatPromise(NodeFS.toPortablePath(p));
  }

  lstatSync(p: string) {
    return this.baseFs.lstatSync(NodeFS.toPortablePath(p));
  }

  async chmodPromise(p: string, mask: number) {
    return await this.baseFs.chmodPromise(NodeFS.toPortablePath(p), mask);
  }

  chmodSync(p: string, mask: number) {
    return this.baseFs.chmodSync(NodeFS.toPortablePath(p), mask);
  }

  async renamePromise(oldP: string, newP: string) {
    return await this.baseFs.renamePromise(NodeFS.toPortablePath(oldP), NodeFS.toPortablePath(newP));
  }

  renameSync(oldP: string, newP: string) {
    return this.baseFs.renameSync(NodeFS.toPortablePath(oldP), NodeFS.toPortablePath(newP));
  }

  async copyFilePromise(sourceP: string, destP: string, flags?: number) {
    return await this.baseFs.copyFilePromise(NodeFS.toPortablePath(sourceP), NodeFS.toPortablePath(destP), flags);
  }

  copyFileSync(sourceP: string, destP: string, flags?: number) {
    return this.baseFs.copyFileSync(NodeFS.toPortablePath(sourceP), NodeFS.toPortablePath(destP), flags);
  }

  async writeFilePromise(p: string, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return await this.baseFs.writeFilePromise(NodeFS.toPortablePath(p), content, opts);
  }

  writeFileSync(p: string, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return this.baseFs.writeFileSync(NodeFS.toPortablePath(p), content, opts);
  }

  async unlinkPromise(p: string) {
    return await this.baseFs.unlinkPromise(NodeFS.toPortablePath(p));
  }

  unlinkSync(p: string) {
    return this.baseFs.unlinkSync(NodeFS.toPortablePath(p));
  }

  async utimesPromise(p: string, atime: Date | string | number, mtime: Date | string | number) {
    return await this.baseFs.utimesPromise(NodeFS.toPortablePath(p), atime, mtime);
  }

  utimesSync(p: string, atime: Date | string | number, mtime: Date | string | number) {
    return this.baseFs.utimesSync(NodeFS.toPortablePath(p), atime, mtime);
  }

  async mkdirPromise(p: string) {
    return await this.baseFs.mkdirPromise(NodeFS.toPortablePath(p));
  }

  mkdirSync(p: string) {
    return this.baseFs.mkdirSync(NodeFS.toPortablePath(p));
  }

  async rmdirPromise(p: string) {
    return await this.baseFs.rmdirPromise(NodeFS.toPortablePath(p));
  }

  rmdirSync(p: string) {
    return this.baseFs.rmdirSync(NodeFS.toPortablePath(p));
  }

  async symlinkPromise(target: string, p: string) {
    return await this.baseFs.symlinkPromise(target, NodeFS.toPortablePath(p));
  }

  symlinkSync(target: string, p: string) {
    return this.baseFs.symlinkSync(target, NodeFS.toPortablePath(p));
  }

  readFilePromise(p: string, encoding: 'utf8'): Promise<string>;
  readFilePromise(p: string, encoding?: string): Promise<Buffer>;
  async readFilePromise(p: string, encoding?: string) {
    // This weird switch is required to tell TypeScript that the signatures are proper (otherwise it thinks that only the generic one is covered)
    switch (encoding) {
      case `utf8`:
        return await this.baseFs.readFilePromise(NodeFS.toPortablePath(p), encoding);
      default:
        return await this.baseFs.readFilePromise(NodeFS.toPortablePath(p), encoding);
    }
  }

  readFileSync(p: string, encoding: 'utf8'): string;
  readFileSync(p: string, encoding?: string): Buffer;
  readFileSync(p: string, encoding?: string) {
    // This weird switch is required to tell TypeScript that the signatures are proper (otherwise it thinks that only the generic one is covered)
    switch (encoding) {
      case `utf8`:
        return this.baseFs.readFileSync(NodeFS.toPortablePath(p), encoding);
      default:
        return this.baseFs.readFileSync(NodeFS.toPortablePath(p), encoding);
    }
  }

  async readdirPromise(p: string) {
    return await this.baseFs.readdirPromise(NodeFS.toPortablePath(p));
  }

  readdirSync(p: string) {
    return this.baseFs.readdirSync(NodeFS.toPortablePath(p));
  }

  async readlinkPromise(p: string) {
    return NodeFS.fromPortablePath(await this.baseFs.readlinkPromise(NodeFS.toPortablePath(p)));
  }

  readlinkSync(p: string) {
    return NodeFS.fromPortablePath(this.baseFs.readlinkSync(NodeFS.toPortablePath(p)));
  }
}
