import {posix}                                             from 'path';

import {CreateReadStreamOptions, CreateWriteStreamOptions} from './FakeFS';
import {FakeFS, WriteFileOptions}                          from './FakeFS';
import {NodeFS}                                            from './NodeFS';

export type JailFSOptions = {
  baseFs?: FakeFS,
};

export class JailFS extends FakeFS {
  private readonly target: string;

  private readonly baseFs: FakeFS;

  constructor(target: string, {baseFs = new NodeFS()}: JailFSOptions = {}) {
    super();

    this.target = posix.resolve(`/`, target);

    this.baseFs = baseFs;
  }

  getRealPath() {
    return posix.resolve(this.baseFs.getRealPath(), posix.relative(`/`, this.target));
  }

  getTarget() {
    return this.target;
  }

  getBaseFs() {
    return this.baseFs;
  }

  async openPromise(p: string, flags: string, mode?: number) {
    return await this.baseFs.openPromise(this.fromJailedPath(p), flags, mode);
  }

  openSync(p: string, flags: string, mode?: number) {
    return this.baseFs.openSync(this.fromJailedPath(p), flags, mode);
  }

  async closePromise(fd: number) {
    await this.baseFs.closePromise(fd);
  }

  closeSync(fd: number) {
    this.baseFs.closeSync(fd);
  }

  createReadStream(p: string, opts?: CreateReadStreamOptions) {
    return this.baseFs.createReadStream(this.fromJailedPath(p), opts);
  }

  createWriteStream(p: string, opts?: CreateWriteStreamOptions) {
    return this.baseFs.createWriteStream(this.fromJailedPath(p), opts);
  }

  async realpathPromise(p: string) {
    return this.toJailedPath(await this.baseFs.realpathPromise(this.fromJailedPath(p)));
  }

  realpathSync(p: string) {
    return this.toJailedPath(this.baseFs.realpathSync(this.fromJailedPath(p)));
  }

  async existsPromise(p: string) {
    return await this.baseFs.existsPromise(this.fromJailedPath(p));
  }

  existsSync(p: string) {
    return this.baseFs.existsSync(this.fromJailedPath(p));
  }

  async accessPromise(p: string, mode?: number) {
    return await this.baseFs.accessPromise(this.fromJailedPath(p), mode);
  }

  accessSync(p: string, mode?: number) {
    return this.baseFs.accessSync(this.fromJailedPath(p), mode);
  }

  async statPromise(p: string) {
    return await this.baseFs.statPromise(this.fromJailedPath(p));
  }

  statSync(p: string) {
    return this.baseFs.statSync(this.fromJailedPath(p));
  }

  async lstatPromise(p: string) {
    return await this.baseFs.lstatPromise(this.fromJailedPath(p));
  }

  lstatSync(p: string) {
    return this.baseFs.lstatSync(this.fromJailedPath(p));
  }

  async chmodPromise(p: string, mask: number) {
    return await this.baseFs.chmodPromise(this.fromJailedPath(p), mask);
  }

  chmodSync(p: string, mask: number) {
    return this.baseFs.chmodSync(this.fromJailedPath(p), mask);
  }

  async renamePromise(oldP: string, newP: string) {
    return await this.baseFs.renamePromise(this.fromJailedPath(oldP), this.fromJailedPath(newP));
  }

  renameSync(oldP: string, newP: string) {
    return this.baseFs.renameSync(this.fromJailedPath(oldP), this.fromJailedPath(newP));
  }

  async copyFilePromise(sourceP: string, destP: string, flags?: number) {
    return await this.baseFs.copyFilePromise(this.fromJailedPath(sourceP), this.fromJailedPath(destP), flags);
  }

  copyFileSync(sourceP: string, destP: string, flags?: number) {
    return this.baseFs.copyFileSync(this.fromJailedPath(sourceP), this.fromJailedPath(destP), flags);
  }

  async writeFilePromise(p: string, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return await this.baseFs.writeFilePromise(this.fromJailedPath(p), content, opts);
  }

  writeFileSync(p: string, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return this.baseFs.writeFileSync(this.fromJailedPath(p), content, opts);
  }

  async unlinkPromise(p: string) {
    return await this.baseFs.unlinkPromise(this.fromJailedPath(p));
  }

  unlinkSync(p: string) {
    return this.baseFs.unlinkSync(this.fromJailedPath(p));
  }

  async utimesPromise(p: string, atime: Date | string | number, mtime: Date | string | number) {
    return await this.baseFs.utimesPromise(this.fromJailedPath(p), atime, mtime);
  }

  utimesSync(p: string, atime: Date | string | number, mtime: Date | string | number) {
    return this.baseFs.utimesSync(this.fromJailedPath(p), atime, mtime);
  }

  async mkdirPromise(p: string) {
    return await this.baseFs.mkdirPromise(this.fromJailedPath(p));
  }

  mkdirSync(p: string) {
    return this.baseFs.mkdirSync(this.fromJailedPath(p));
  }

  async rmdirPromise(p: string) {
    return await this.baseFs.rmdirPromise(this.fromJailedPath(p));
  }

  rmdirSync(p: string) {
    return this.baseFs.rmdirSync(this.fromJailedPath(p));
  }

  async symlinkPromise(target: string, p: string) {
    return await this.baseFs.symlinkPromise(target, this.fromJailedPath(p));
  }

  symlinkSync(target: string, p: string) {
    return this.baseFs.symlinkSync(target, this.fromJailedPath(p));
  }

  readFilePromise(p: string, encoding: 'utf8'): Promise<string>;
  readFilePromise(p: string, encoding?: string): Promise<Buffer>;
  async readFilePromise(p: string, encoding?: string) {
    // This weird switch is required to tell TypeScript that the signatures are proper (otherwise it thinks that only the generic one is covered)
    switch (encoding) {
      case `utf8`:
        return await this.baseFs.readFilePromise(this.fromJailedPath(p), encoding);
      default:
        return await this.baseFs.readFilePromise(this.fromJailedPath(p), encoding);
    }
  }

  readFileSync(p: string, encoding: 'utf8'): string;
  readFileSync(p: string, encoding?: string): Buffer;
  readFileSync(p: string, encoding?: string) {
    // This weird switch is required to tell TypeScript that the signatures are proper (otherwise it thinks that only the generic one is covered)
    switch (encoding) {
      case `utf8`:
        return this.baseFs.readFileSync(this.fromJailedPath(p), encoding);
      default:
        return this.baseFs.readFileSync(this.fromJailedPath(p), encoding);
    }
  }

  async readdirPromise(p: string) {
    return await this.baseFs.readdirPromise(this.fromJailedPath(p));
  }

  readdirSync(p: string) {
    return this.baseFs.readdirSync(this.fromJailedPath(p));
  }

  async readlinkPromise(p: string) {
    return await this.baseFs.readlinkPromise(this.fromJailedPath(p));
  }

  readlinkSync(p: string) {
    return this.baseFs.readlinkSync(this.fromJailedPath(p));
  }

  private fromJailedPath(p: string) {
    const normalized = posix.normalize(p);

    if (posix.isAbsolute(p))
      return posix.resolve(this.target, posix.relative(`/`, p));

    if (normalized.match(/^\.\.\//))
      throw new Error(`Resolving this path (${p}) would escape the jail`);

    return posix.resolve(this.target, p);
  }

  private toJailedPath(p: string) {
    return posix.resolve(`/`, posix.relative(this.target, p));
  }
}
