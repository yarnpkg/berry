import {CreateReadStreamOptions, CreateWriteStreamOptions} from './FakeFS';
import {FakeFS, WriteFileOptions}                          from './FakeFS';

export type LazyFSFactory = () => FakeFS;

export class LazyFS extends FakeFS {
  private readonly factory: LazyFSFactory;

  private baseFs: FakeFS | null = null;

  constructor(factory: LazyFSFactory) {
    super();

    this.factory = factory;
  }

  getRealPath() {
    return this.prepareFs().getRealPath();
  }

  async openPromise(p: string, flags: string, mode?: number) {
    return await this.prepareFs().openPromise(p, flags, mode);
  }

  openSync(p: string, flags: string, mode?: number) {
    return this.prepareFs().openSync(p, flags, mode);
  }

  async closePromise(fd: number) {
    await this.prepareFs().closePromise(fd);
  }

  closeSync(fd: number) {
    this.prepareFs().closeSync(fd);
  }

  createReadStream(p: string, opts?: CreateReadStreamOptions) {
    return this.prepareFs().createReadStream(p, opts);
  }

  createWriteStream(p: string, opts?: CreateWriteStreamOptions) {
    return this.prepareFs().createWriteStream(p, opts);
  }

  async realpathPromise(p: string) {
    return await this.prepareFs().realpathPromise(p);
  }

  realpathSync(p: string) {
    return this.prepareFs().realpathSync(p);
  }

  async existsPromise(p: string) {
    return await this.prepareFs().existsPromise(p);
  }

  existsSync(p: string) {
    return this.prepareFs().existsSync(p);
  }

  async accessPromise(p: string, mode?: number) {
    return await this.prepareFs().accessPromise(p, mode);
  }

  accessSync(p: string, mode?: number) {
    return this.prepareFs().accessSync(p, mode);
  }

  async statPromise(p: string) {
    return await this.prepareFs().statPromise(p);
  }

  statSync(p: string) {
    return this.prepareFs().statSync(p);
  }

  async lstatPromise(p: string) {
    return await this.prepareFs().lstatPromise(p);
  }

  lstatSync(p: string) {
    return this.prepareFs().lstatSync(p);
  }

  async chmodPromise(p: string, mask: number) {
    return await this.prepareFs().chmodPromise(p, mask);
  }

  chmodSync(p: string, mask: number) {
    return this.prepareFs().chmodSync(p, mask);
  }

  async renamePromise(oldP: string, newP: string) {
    return await this.prepareFs().renamePromise(oldP, newP);
  }

  renameSync(oldP: string, newP: string) {
    return this.prepareFs().renameSync(oldP, newP);
  }

  async copyFilePromise(sourceP: string, destP: string, flags?: number) {
    return await this.prepareFs().copyFilePromise(sourceP, destP, flags);
  }

  copyFileSync(sourceP: string, destP: string, flags?: number) {
    return this.prepareFs().copyFileSync(sourceP, destP, flags);
  }

  async writeFilePromise(p: string, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return await this.prepareFs().writeFilePromise(p, content, opts);
  }

  writeFileSync(p: string, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return this.prepareFs().writeFileSync(p, content, opts);
  }

  async unlinkPromise(p: string) {
    return await this.prepareFs().unlinkPromise(p);
  }

  unlinkSync(p: string) {
    return this.prepareFs().unlinkSync(p);
  }

  async utimesPromise(p: string, atime: Date | string | number, mtime: Date | string | number) {
    return await this.prepareFs().utimesPromise(p, atime, mtime);
  }

  utimesSync(p: string, atime: Date | string | number, mtime: Date | string | number) {
    return this.prepareFs().utimesSync(p, atime, mtime);
  }

  async mkdirPromise(p: string) {
    return await this.prepareFs().mkdirPromise(p);
  }

  mkdirSync(p: string) {
    return this.prepareFs().mkdirSync(p);
  }

  async rmdirPromise(p: string) {
    return await this.prepareFs().rmdirPromise(p);
  }

  rmdirSync(p: string) {
    return this.prepareFs().rmdirSync(p);
  }

  async symlinkPromise(target: string, p: string) {
    return await this.prepareFs().symlinkPromise(target, p);
  }

  symlinkSync(target: string, p: string) {
    return this.prepareFs().symlinkSync(target, p);
  }

  readFilePromise(p: string, encoding: 'utf8'): Promise<string>;
  readFilePromise(p: string, encoding?: string): Promise<Buffer>;
  async readFilePromise(p: string, encoding?: string) {
    // This weird switch is required to tell TypeScript that the signatures are proper (otherwise it thinks that only the generic one is covered)
    switch (encoding) {
      case `utf8`:
        return await this.prepareFs().readFilePromise(p, encoding);
      default:
        return await this.prepareFs().readFilePromise(p, encoding);
    }
  }

  readFileSync(p: string, encoding: 'utf8'): string;
  readFileSync(p: string, encoding?: string): Buffer;
  readFileSync(p: string, encoding?: string) {
    // This weird switch is required to tell TypeScript that the signatures are proper (otherwise it thinks that only the generic one is covered)
    switch (encoding) {
      case `utf8`:
        return this.prepareFs().readFileSync(p, encoding);
      default:
        return this.prepareFs().readFileSync(p, encoding);
    }
  }

  async readdirPromise(p: string) {
    return await this.prepareFs().readdirPromise(p);
  }

  readdirSync(p: string) {
    return this.prepareFs().readdirSync(p);
  }

  async readlinkPromise(p: string) {
    return await this.prepareFs().readlinkPromise(p);
  }

  readlinkSync(p: string) {
    return this.prepareFs().readlinkSync(p);
  }

  private prepareFs() {
    let baseFs = this.baseFs;

    if (baseFs === null)
      baseFs = this.baseFs = this.factory();

    return baseFs;
  }
}
