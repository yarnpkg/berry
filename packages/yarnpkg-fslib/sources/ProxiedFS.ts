import {CreateReadStreamOptions, CreateWriteStreamOptions, FakeFS, ExtractHintOptions} from './FakeFS';
import {Dirent, SymlinkType}                                                           from './FakeFS';
import {MkdirOptions, WriteFileOptions, WatchCallback, WatchOptions, Watcher}          from './FakeFS';
import {FSPath, Filename, Path}                                                        from './path';

export abstract class ProxiedFS<P extends Path, IP extends Path> extends FakeFS<P> {
  protected abstract readonly baseFs: FakeFS<IP>;

  /**
   * Convert a path from the user format into what should be fed into the internal FS.
   */
  protected abstract mapToBase(path: P): IP;

  /**
   * Convert a path from the format supported by the base FS into the user one.
   */
  protected abstract mapFromBase(path: IP): P;

  getExtractHint(hints: ExtractHintOptions) {
    return this.baseFs.getExtractHint(hints);
  }

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

  async readPromise(fd: number, buffer: Buffer, offset?: number, length?: number, position?: number | null) {
    return await this.baseFs.readPromise(fd, buffer, offset, length, position);
  }

  readSync(fd: number, buffer: Buffer, offset: number, length: number, position: number) {
    return this.baseFs.readSync(fd, buffer, offset, length, position);
  }

  writePromise(fd: number, buffer: Buffer, offset?: number, length?: number, position?: number): Promise<number>;
  writePromise(fd: number, buffer: string, position?: number): Promise<number>;
  async writePromise(fd: number, buffer: Buffer | string, offset?: number, length?: number, position?: number): Promise<number> {
    if (typeof buffer === `string`) {
      return await this.baseFs.writePromise(fd, buffer, offset);
    } else {
      return await this.baseFs.writePromise(fd, buffer, offset, length, position);
    }
  }

  writeSync(fd: number, buffer: Buffer, offset?: number, length?: number, position?: number): number;
  writeSync(fd: number, buffer: string, position?: number): number;
  writeSync(fd: number, buffer: Buffer | string, offset?: number, length?: number, position?: number) {
    if (typeof buffer === `string`) {
      return this.baseFs.writeSync(fd, buffer, offset);
    } else {
      return this.baseFs.writeSync(fd, buffer, offset, length, position);
    }
  }

  closePromise(fd: number) {
    return this.baseFs.closePromise(fd);
  }

  closeSync(fd: number) {
    this.baseFs.closeSync(fd);
  }

  createReadStream(p: P | null, opts?: CreateReadStreamOptions) {
    return this.baseFs.createReadStream(p !== null ? this.mapToBase(p) : p, opts);
  }

  createWriteStream(p: P | null, opts?: CreateWriteStreamOptions) {
    return this.baseFs.createWriteStream(p !== null ? this.mapToBase(p) : p, opts);
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

  appendFilePromise(p: FSPath<P>, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return this.baseFs.appendFilePromise(this.fsMapToBase(p), content, opts);
  }

  appendFileSync(p: FSPath<P>, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return this.baseFs.appendFileSync(this.fsMapToBase(p), content, opts);
  }

  writeFilePromise(p: FSPath<P>, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return this.baseFs.writeFilePromise(this.fsMapToBase(p), content, opts);
  }

  writeFileSync(p: FSPath<P>, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return this.baseFs.writeFileSync(this.fsMapToBase(p), content, opts);
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

  mkdirPromise(p: P, opts?: MkdirOptions) {
    return this.baseFs.mkdirPromise(this.mapToBase(p), opts);
  }

  mkdirSync(p: P, opts?: MkdirOptions) {
    return this.baseFs.mkdirSync(this.mapToBase(p), opts);
  }

  rmdirPromise(p: P) {
    return this.baseFs.rmdirPromise(this.mapToBase(p));
  }

  rmdirSync(p: P) {
    return this.baseFs.rmdirSync(this.mapToBase(p));
  }

  symlinkPromise(target: P, p: P, type?: SymlinkType) {
    return this.baseFs.symlinkPromise(this.mapToBase(target), this.mapToBase(p), type);
  }

  symlinkSync(target: P, p: P, type?: SymlinkType) {
    return this.baseFs.symlinkSync(this.mapToBase(target), this.mapToBase(p), type);
  }

  readFilePromise(p: FSPath<P>, encoding: 'utf8'): Promise<string>;
  readFilePromise(p: FSPath<P>, encoding?: string): Promise<Buffer>;
  readFilePromise(p: FSPath<P>, encoding?: string) {
    // This weird condition is required to tell TypeScript that the signatures are proper (otherwise it thinks that only the generic one is covered)
    if (encoding === `utf8`) {
      return this.baseFs.readFilePromise(this.fsMapToBase(p), encoding);
    } else {
      return this.baseFs.readFilePromise(this.fsMapToBase(p), encoding);
    }
  }

  readFileSync(p: FSPath<P>, encoding: 'utf8'): string;
  readFileSync(p: FSPath<P>, encoding?: string): Buffer;
  readFileSync(p: FSPath<P>, encoding?: string) {
    // This weird condition is required to tell TypeScript that the signatures are proper (otherwise it thinks that only the generic one is covered)
    if (encoding === `utf8`) {
      return this.baseFs.readFileSync(this.fsMapToBase(p), encoding);
    } else  {
      return this.baseFs.readFileSync(this.fsMapToBase(p), encoding);
    }
  }

  async readdirPromise(p: P): Promise<Array<Filename>>;
  async readdirPromise(p: P, opts: {withFileTypes: false}): Promise<Array<Filename>>;
  async readdirPromise(p: P, opts: {withFileTypes: true}): Promise<Array<Dirent>>;
  async readdirPromise(p: P, opts: {withFileTypes: boolean}): Promise<Array<Filename> | Array<Dirent>>;
  async readdirPromise(p: P, {withFileTypes}: {withFileTypes?: boolean} = {}): Promise<Array<string> | Array<Dirent>> {
    return this.baseFs.readdirPromise(this.mapToBase(p), {withFileTypes: withFileTypes as any});
  }

  readdirSync(p: P): Array<Filename>;
  readdirSync(p: P, opts: {withFileTypes: false}): Array<Filename>;
  readdirSync(p: P, opts: {withFileTypes: true}): Array<Dirent>;
  readdirSync(p: P, opts: {withFileTypes: boolean}): Array<Filename> | Array<Dirent>;
  readdirSync(p: P, {withFileTypes}: {withFileTypes?: boolean} = {}): Array<string> | Array<Dirent> {
    return this.baseFs.readdirSync(this.mapToBase(p), {withFileTypes: withFileTypes as any});
  }

  async readlinkPromise(p: P) {
    return this.mapFromBase(await this.baseFs.readlinkPromise(this.mapToBase(p)));
  }

  readlinkSync(p: P) {
    return this.mapFromBase(this.baseFs.readlinkSync(this.mapToBase(p)));
  }

  watch(p: P, cb?: WatchCallback): Watcher;
  watch(p: P, opts: WatchOptions, cb?: WatchCallback): Watcher;
  watch(p: P, a?: WatchOptions | WatchCallback, b?: WatchCallback) {
    return this.baseFs.watch(
      this.mapToBase(p),
      // @ts-ignore
      a,
      b,
    );
  }

  private fsMapToBase(p: FSPath<P>) {
    if (typeof p === `number`) {
      return p;
    } else {
      return this.mapToBase(p);
    }
  }
}
