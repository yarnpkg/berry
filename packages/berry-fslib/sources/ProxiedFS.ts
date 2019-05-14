import {CreateReadStreamOptions, CreateWriteStreamOptions, FakeFS} from './FakeFS';
import {WriteFileOptions}                                          from './FakeFS';
import {Path}                                                      from './path';

export abstract class ProxiedFS<P extends Path, IP extends Path> extends FakeFS<P> {
  protected abstract readonly baseFs: FakeFS<IP>;

  protected abstract mapToBase(path: P): IP;

  protected abstract mapFromBase(path: IP): P;

  resolve(path: P)  {
    return this.mapFromBase(this.baseFs.resolve(this.mapToBase(path)));
  }

  getRealPath() {
    return this.mapFromBase(this.baseFs.getRealPath());
  }

  openPromise(p: P, flags: string, mode?: number) {
    return this.baseFs.openPromise(this.mapToBase(p), flags, mode);
  }

  openSync(p: P, flags: string, mode?: number) {
    return this.baseFs.openSync(this.mapToBase(p), flags, mode);
  }

  closePromise(fd: number) {
    return this.baseFs.closePromise(fd);
  }

  closeSync(fd: number) {
    this.baseFs.closeSync(fd);
  }

  createReadStream(p: P, opts?: CreateReadStreamOptions) {
    return this.baseFs.createReadStream(this.mapToBase(p), opts);
  }

  createWriteStream(p: P, opts?: CreateWriteStreamOptions) {
    return this.baseFs.createWriteStream(this.mapToBase(p), opts);
  }

  async realpathPromise(p: P) {
    return this.mapFromBase(await this.baseFs.realpathPromise(this.mapToBase(p)));
  }

  realpathSync(p: P) {
    return this.mapFromBase(this.baseFs.realpathSync(this.mapToBase(p)));
  }

  existsPromise(p: P) {
    return this.baseFs.existsPromise(this.mapToBase(p));
  }

  existsSync(p: P) {
    return this.baseFs.existsSync(this.mapToBase(p));
  }

  accessSync(p: P, mode?: number) {
    return this.baseFs.accessSync(this.mapToBase(p), mode);
  }

  accessPromise(p: P, mode?: number) {
    return this.baseFs.accessPromise(this.mapToBase(p), mode);
  }

  statPromise(p: P) {
    return this.baseFs.statPromise(this.mapToBase(p));
  }

  statSync(p: P) {
    return this.baseFs.statSync(this.mapToBase(p));
  }

  lstatPromise(p: P) {
    return this.baseFs.lstatPromise(this.mapToBase(p));
  }

  lstatSync(p: P) {
    return this.baseFs.lstatSync(this.mapToBase(p));
  }

  chmodPromise(p: P, mask: number) {
    return this.baseFs.chmodPromise(this.mapToBase(p), mask);
  }

  chmodSync(p: P, mask: number) {
    return this.baseFs.chmodSync(this.mapToBase(p), mask);
  }

  renamePromise(oldP: P, newP: P) {
    return this.baseFs.renamePromise(this.mapToBase(oldP), this.mapToBase(newP));
  }

  renameSync(oldP: P, newP: P) {
    return this.baseFs.renameSync(this.mapToBase(oldP), this.mapToBase(newP));
  }

  copyFilePromise(sourceP: P, destP: P, flags: number = 0) {
    return this.baseFs.copyFilePromise(this.mapToBase(sourceP), this.mapToBase(destP), flags);
  }

  copyFileSync(sourceP: P, destP: P, flags: number = 0) {
    return this.baseFs.copyFileSync(this.mapToBase(sourceP), this.mapToBase(destP), flags);
  }

  writeFilePromise(p: P, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return this.baseFs.writeFilePromise(this.mapToBase(p), content, opts);
  }

  writeFileSync(p: P, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return this.baseFs.writeFileSync(this.mapToBase(p), content, opts);
  }

  unlinkPromise(p: P) {
    return this.baseFs.unlinkPromise(this.mapToBase(p));
  }

  unlinkSync(p: P) {
    return this.baseFs.unlinkSync(this.mapToBase(p));
  }

  utimesPromise(p: P, atime: Date | string | number, mtime: Date | string | number) {
    return this.baseFs.utimesPromise(this.mapToBase(p), atime, mtime);
  }

  utimesSync(p: P, atime: Date | string | number, mtime: Date | string | number) {
    return this.baseFs.utimesSync(this.mapToBase(p), atime, mtime);
  }

  mkdirPromise(p: P) {
    return this.baseFs.mkdirPromise(this.mapToBase(p));
  }

  mkdirSync(p: P) {
    return this.baseFs.mkdirSync(this.mapToBase(p));
  }

  rmdirPromise(p: P) {
    return this.baseFs.rmdirPromise(this.mapToBase(p));
  }

  rmdirSync(p: P) {
    return this.baseFs.rmdirSync(this.mapToBase(p));
  }

  symlinkPromise(target: P, p: P) {
    return this.baseFs.symlinkPromise(this.mapToBase(target), this.mapToBase(p));
  }

  symlinkSync(target: P, p: P) {
    return this.baseFs.symlinkSync(this.mapToBase(target), this.mapToBase(p));
  }

  readFilePromise(p: P, encoding: 'utf8'): Promise<string>;
  readFilePromise(p: P, encoding?: string): Promise<Buffer>;
  readFilePromise(p: P, encoding?: string) {
    // This weird condition is required to tell TypeScript that the signatures are proper (otherwise it thinks that only the generic one is covered)
    if (encoding === 'utf8') {
      return this.baseFs.readFilePromise(this.mapToBase(p), encoding);
    } else {
      return this.baseFs.readFilePromise(this.mapToBase(p), encoding);
    }
  }

  readFileSync(p: P, encoding: 'utf8'): string;
  readFileSync(p: P, encoding?: string): Buffer;
  readFileSync(p: P, encoding?: string) {
    // This weird condition is required to tell TypeScript that the signatures are proper (otherwise it thinks that only the generic one is covered)
    if (encoding === 'utf8') {
      return this.baseFs.readFileSync(this.mapToBase(p), encoding);
    } else  {
      return this.baseFs.readFileSync(this.mapToBase(p), encoding);
    }
  }

  readdirPromise(p: P) {
    return this.baseFs.readdirPromise(this.mapToBase(p));
  }

  readdirSync(p: P) {
    return this.baseFs.readdirSync(this.mapToBase(p));
  }

  async readlinkPromise(p: P) {
    return this.mapFromBase(await this.baseFs.readlinkPromise(this.mapToBase(p)));
  }

  readlinkSync(p: P) {
    return this.mapFromBase(this.baseFs.readlinkSync(this.mapToBase(p)));
  }

  removePromise(p: P) {
    return this.baseFs.removePromise(this.mapToBase(p));
  }

  removeSync(p: P) {
    return this.baseFs.removeSync(this.mapToBase(p));
  }

  mkdirpPromise(p: P, options?: {chmod?: number, utimes?: [Date | string | number, Date | string | number]}) {
    return this.baseFs.mkdirpPromise(this.mapToBase(p), options);
  }
  mkdirpSync(p: P, options?: {chmod?: number, utimes?: [Date | string | number, Date | string | number]}) {
    return this.baseFs.mkdirpSync(this.mapToBase(p), options);
  }

  copyPromise(destination: P, source: P, options?: {baseFs?: undefined, overwrite?: boolean}): Promise<void>;
  copyPromise<P2 extends Path>(destination: P, source: P2, options: {baseFs: FakeFS<P2>, overwrite?: boolean}): Promise<void>;
  copyPromise<P2 extends Path>(destination: P, source: P2, {baseFs = this as any, overwrite}: {baseFs?: FakeFS<P2>, overwrite?: boolean} = {}) {
    // any casts are necessary because typescript doesn't understand that P2 might be P
    if (baseFs === this as any) {
      return this.baseFs.copyPromise(this.mapToBase(destination), this.mapToBase(source as any), {baseFs: this.baseFs, overwrite});
    } else {
      return this.baseFs.copyPromise(this.mapToBase(destination), source, {baseFs, overwrite});
    }
  }

  copySync(destination: P, source: P, options?: {baseFs?: undefined, overwrite?: boolean}): void;
  copySync<P2 extends Path>(destination: P, source: P2, options: {baseFs: FakeFS<P2>, overwrite?: boolean}): void;
  copySync<P2 extends Path>(destination: P, source: P2, {baseFs = this as any, overwrite}: {baseFs?: FakeFS<P2>, overwrite?: boolean} = {}) {
    // any casts are necessary because typescript doesn't understand that P2 might be P
    if (baseFs === this as any) {
      return this.baseFs.copySync(this.mapToBase(destination), this.mapToBase(source as any), {baseFs: this.baseFs, overwrite});
    } else {
      return this.baseFs.copySync(this.mapToBase(destination), source, {baseFs, overwrite});
    }
  }
}
