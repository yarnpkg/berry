import {posix}                                             from 'path';

import {CreateReadStreamOptions, CreateWriteStreamOptions} from './FakeFS';
import {FakeFS, WriteFileOptions}                          from './FakeFS';

export type AliasFSOptions = {
  baseFs: FakeFS,
};

export class AliasFS extends FakeFS {
  private readonly target: string;

  private readonly baseFs: FakeFS;

  constructor(target: string, {baseFs}: AliasFSOptions) {
    super();

    this.target = target;
    this.baseFs = baseFs;
  }

  getRealPath() {
    return this.target;
  }

  getBaseFs() {
    return this.baseFs;
  }

  async openPromise(p: string, flags: string, mode?: number) {
    return await this.baseFs.openPromise(p, flags, mode);
  }

  openSync(p: string, flags: string, mode?: number) {
    return this.baseFs.openSync(p, flags, mode);
  }

  async closePromise(fd: number) {
    await this.baseFs.closePromise(fd);
  }

  closeSync(fd: number) {
    this.baseFs.closeSync(fd);
  }

  createReadStream(p: string, opts?: CreateReadStreamOptions) {
    return this.baseFs.createReadStream(p, opts);
  }

  createWriteStream(p: string, opts?: CreateWriteStreamOptions) {
    return this.baseFs.createWriteStream(p, opts);
  }

  async realpathPromise(p: string) {
    return await this.baseFs.realpathPromise(p);
  }

  realpathSync(p: string) {
    return this.baseFs.realpathSync(p);
  }

  async existsPromise(p: string) {
    return await this.baseFs.existsPromise(p);
  }

  existsSync(p: string) {
    return this.baseFs.existsSync(p);
  }

  async statPromise(p: string) {
    return await this.baseFs.statPromise(p);
  }

  statSync(p: string) {
    return this.baseFs.statSync(p);
  }

  async lstatPromise(p: string) {
    return await this.baseFs.lstatPromise(p);
  }

  lstatSync(p: string) {
    return this.baseFs.lstatSync(p);
  }

  async chmodPromise(p: string, mask: number) {
    return await this.baseFs.chmodPromise(p, mask);
  }

  chmodSync(p: string, mask: number) {
    return this.baseFs.chmodSync(p, mask);
  }

  async renamePromise(oldP: string, newP: string) {
    return await this.baseFs.renamePromise(oldP, newP);
  }

  renameSync(oldP: string, newP: string) {
    return this.baseFs.renameSync(oldP, newP);
  }

  async writeFilePromise(p: string, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return await this.baseFs.writeFilePromise(p, content, opts);
  }

  writeFileSync(p: string, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return this.baseFs.writeFileSync(p, content, opts);
  }

  async unlinkPromise(p: string) {
    return await this.baseFs.unlinkPromise(p);
  }

  unlinkSync(p: string) {
    return this.baseFs.unlinkSync(p);
  }

  async utimesPromise(p: string, atime: Date | string | number, mtime: Date | string | number) {
    return await this.baseFs.utimesPromise(p, atime, mtime);
  }

  utimesSync(p: string, atime: Date | string | number, mtime: Date | string | number) {
    return this.baseFs.utimesSync(p, atime, mtime);
  }

  async mkdirPromise(p: string) {
    return await this.baseFs.mkdirPromise(p);
  }

  mkdirSync(p: string) {
    return this.baseFs.mkdirSync(p);
  }

  async rmdirPromise(p: string) {
    return await this.baseFs.rmdirPromise(p);
  }

  rmdirSync(p: string) {
    return this.baseFs.rmdirSync(p);
  }

  async symlinkPromise(target: string, p: string) {
    return await this.baseFs.symlinkPromise(target, p);
  }

  symlinkSync(target: string, p: string) {
    return this.baseFs.symlinkSync(target, p);
  }

  readFilePromise(p: string, encoding: 'utf8'): Promise<string>;
  readFilePromise(p: string, encoding?: string): Promise<Buffer>;
  async readFilePromise(p: string, encoding?: string) {
    // This weird switch is required to tell TypeScript that the signatures are proper (otherwise it thinks that only the generic one is covered)
    switch (encoding) {
      case `utf8`:
        return await this.baseFs.readFilePromise(p, encoding);
      default:
        return await this.baseFs.readFilePromise(p, encoding);
    }
  }

  readFileSync(p: string, encoding: 'utf8'): string;
  readFileSync(p: string, encoding?: string): Buffer;
  readFileSync(p: string, encoding?: string) {
    // This weird switch is required to tell TypeScript that the signatures are proper (otherwise it thinks that only the generic one is covered)
    switch (encoding) {
      case `utf8`:
        return this.baseFs.readFileSync(p, encoding);
      default:
        return this.baseFs.readFileSync(p, encoding);
    }
  }

  async readdirPromise(p: string) {
    return await this.baseFs.readdirPromise(p);
  }

  readdirSync(p: string) {
    return this.baseFs.readdirSync(p);
  }

  async readlinkPromise(p: string) {
    return await this.baseFs.readlinkPromise(p);
  }

  readlinkSync(p: string) {
    return this.baseFs.readlinkSync(p);
  }
}
