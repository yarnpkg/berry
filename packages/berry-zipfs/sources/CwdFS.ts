import {posix}                    from 'path';

import {FakeFS, WriteFileOptions} from './FakeFS';
import {NodeFS}                   from './NodeFS';

export type CwdFSOptions = {
  baseFs?: FakeFS,
};

export class CwdFS extends FakeFS {
  private readonly target: string;

  private readonly baseFs: FakeFS;

  constructor(target: string, {baseFs = new NodeFS()}: CwdFSOptions = {}) {
    super();

    this.target = target;

    this.baseFs = baseFs;
  }

  getRealPath() {
    return posix.resolve(this.baseFs.getRealPath(), this.target);
  }

  getTarget() {
    return this.target;
  }

  getBaseFs() {
    return this.baseFs;
  }

  resolve(p: string) {
    return this.baseFs.resolve(this.fromCwdPath(p));
  }

  createReadStream(p: string, opts: {encoding?: string}) {
    return this.baseFs.createReadStream(this.fromCwdPath(p), opts);
  }

  async realpathPromise(p: string) {
    return await this.baseFs.realpathPromise(this.fromCwdPath(p));
  }

  realpathSync(p: string) {
    return this.baseFs.realpathSync(this.fromCwdPath(p));
  }

  async existsPromise(p: string) {
    return await this.baseFs.existsPromise(this.fromCwdPath(p));
  }

  existsSync(p: string) {
    return this.baseFs.existsSync(this.fromCwdPath(p));
  }

  async statPromise(p: string) {
    return await this.baseFs.statPromise(this.fromCwdPath(p));
  }

  statSync(p: string) {
    return this.baseFs.statSync(this.fromCwdPath(p));
  }

  async lstatPromise(p: string) {
    return await this.baseFs.lstatPromise(this.fromCwdPath(p));
  }

  lstatSync(p: string) {
    return this.baseFs.lstatSync(this.fromCwdPath(p));
  }

  async chmodPromise(p: string, mask: number) {
    return await this.baseFs.chmodPromise(this.fromCwdPath(p), mask);
  }

  chmodSync(p: string, mask: number) {
    return this.baseFs.chmodSync(this.fromCwdPath(p), mask);
  }

  async writeFilePromise(p: string, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return await this.baseFs.writeFilePromise(this.fromCwdPath(p), content, opts);
  }

  writeFileSync(p: string, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return this.baseFs.writeFileSync(this.fromCwdPath(p), content, opts);
  }

  async unlinkPromise(p: string) {
    return await this.baseFs.unlinkPromise(this.fromCwdPath(p));
  }

  unlinkSync(p: string) {
    return this.baseFs.unlinkSync(this.fromCwdPath(p));
  }

  async utimesPromise(p: string, atime: Date | string | number, mtime: Date | string | number) {
    return await this.baseFs.utimesPromise(this.fromCwdPath(p), atime, mtime);
  }

  utimesSync(p: string, atime: Date | string | number, mtime: Date | string | number) {
    return this.baseFs.utimesSync(this.fromCwdPath(p), atime, mtime);
  }

  async mkdirPromise(p: string) {
    return await this.baseFs.mkdirPromise(this.fromCwdPath(p));
  }

  mkdirSync(p: string) {
    return this.baseFs.mkdirSync(this.fromCwdPath(p));
  }

  async rmdirPromise(p: string) {
    return await this.baseFs.rmdirPromise(this.fromCwdPath(p));
  }

  rmdirSync(p: string) {
    return this.baseFs.rmdirSync(this.fromCwdPath(p));
  }

  async symlinkPromise(target: string, p: string) {
    return await this.baseFs.symlinkPromise(target, this.fromCwdPath(p));
  }

  symlinkSync(target: string, p: string) {
    return this.baseFs.symlinkSync(target, this.fromCwdPath(p));
  }

  readFilePromise(p: string, encoding: 'utf8'): Promise<string>;
  readFilePromise(p: string, encoding?: string): Promise<Buffer>;
  async readFilePromise(p: string, encoding?: string) {
    // This weird switch is required to tell TypeScript that the signatures are proper (otherwise it thinks that only the generic one is covered)
    switch (encoding) {
      case `utf8`:
        return await this.baseFs.readFilePromise(this.fromCwdPath(p), encoding);
      default:
        return await this.baseFs.readFilePromise(this.fromCwdPath(p), encoding);
    }
  }

  readFileSync(p: string, encoding: 'utf8'): string;
  readFileSync(p: string, encoding?: string): Buffer;
  readFileSync(p: string, encoding?: string) {
    // This weird switch is required to tell TypeScript that the signatures are proper (otherwise it thinks that only the generic one is covered)
    switch (encoding) {
      case `utf8`:
        return this.baseFs.readFileSync(this.fromCwdPath(p), encoding);
      default:
        return this.baseFs.readFileSync(this.fromCwdPath(p), encoding);
    }
  }

  async readdirPromise(p: string) {
    return await this.baseFs.readdirPromise(this.fromCwdPath(p));
  }

  readdirSync(p: string) {
    return this.baseFs.readdirSync(this.fromCwdPath(p));
  }

  async readlinkPromise(p: string) {
    return await this.baseFs.readlinkPromise(this.fromCwdPath(p));
  }

  readlinkSync(p: string) {
    return this.baseFs.readlinkSync(this.fromCwdPath(p));
  }

  private fromCwdPath(p: string) {
    return posix.resolve(this.getRealPath(), p);
  }
}
