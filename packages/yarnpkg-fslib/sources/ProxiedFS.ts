import {Stats, BigIntStats}                                                                                                                                                                 from 'fs';

import {CreateReadStreamOptions, CreateWriteStreamOptions, FakeFS, ExtractHintOptions, WatchFileCallback, WatchFileOptions, StatWatcher, Dir, OpendirOptions, ReaddirOptions, DirentNoPath} from './FakeFS';
import {Dirent, SymlinkType, StatSyncOptions, StatOptions}                                                                                                                                  from './FakeFS';
import {MkdirOptions, RmdirOptions, RmOptions, WriteFileOptions, WatchCallback, WatchOptions, Watcher}                                                                                      from './FakeFS';
import {FSPath, Filename, Path}                                                                                                                                                             from './path';

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

  async openPromise(p: P, flags: string, mode?: number) {
    return this.baseFs.openPromise(this.mapToBase(p), flags, mode);
  }

  openSync(p: P, flags: string, mode?: number) {
    return this.baseFs.openSync(this.mapToBase(p), flags, mode);
  }

  async opendirPromise(p: P, opts?: OpendirOptions): Promise<Dir<P>> {
    return Object.assign(await this.baseFs.opendirPromise(this.mapToBase(p), opts), {path: p});
  }

  opendirSync(p: P, opts?: OpendirOptions): Dir<P> {
    return Object.assign(this.baseFs.opendirSync(this.mapToBase(p), opts), {path: p});
  }

  async readPromise(fd: number, buffer: Buffer, offset?: number, length?: number, position?: number | null) {
    return await this.baseFs.readPromise(fd, buffer, offset, length, position);
  }

  readSync(fd: number, buffer: Buffer, offset: number, length: number, position: number) {
    return this.baseFs.readSync(fd, buffer, offset, length, position);
  }

  async writePromise(fd: number, buffer: Buffer, offset?: number, length?: number, position?: number): Promise<number>;
  async writePromise(fd: number, buffer: string, position?: number): Promise<number>;
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

  async closePromise(fd: number) {
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

  async existsPromise(p: P) {
    return this.baseFs.existsPromise(this.mapToBase(p));
  }

  existsSync(p: P) {
    return this.baseFs.existsSync(this.mapToBase(p));
  }

  accessSync(p: P, mode?: number) {
    return this.baseFs.accessSync(this.mapToBase(p), mode);
  }

  async accessPromise(p: P, mode?: number) {
    return this.baseFs.accessPromise(this.mapToBase(p), mode);
  }

  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/51d793492d4c2e372b01257668dcd3afc58d7352/types/node/v16/fs.d.ts#L1042-L1059
  async statPromise(p: P): Promise<Stats>;
  async statPromise(p: P, opts: (StatOptions & { bigint?: false | undefined }) | undefined): Promise<Stats>;
  async statPromise(p: P, opts: StatOptions & { bigint: true }): Promise<BigIntStats>;
  async statPromise(p: P, opts?: StatOptions): Promise<Stats | BigIntStats> {
    return this.baseFs.statPromise(this.mapToBase(p), opts);
  }

  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/51d793492d4c2e372b01257668dcd3afc58d7352/types/node/v16/fs.d.ts#L931-L967
  statSync(p: P): Stats;
  statSync(p: P, opts?: StatSyncOptions & {bigint?: false | undefined, throwIfNoEntry: false}): Stats | undefined;
  statSync(p: P, opts: StatSyncOptions & {bigint: true, throwIfNoEntry: false}): BigIntStats | undefined;
  statSync(p: P, opts?: StatSyncOptions & {bigint?: false | undefined}): Stats;
  statSync(p: P, opts: StatSyncOptions & {bigint: true}): BigIntStats;
  statSync(p: P, opts: StatSyncOptions & {bigint: boolean, throwIfNoEntry?: false | undefined}): Stats | BigIntStats;
  statSync(p: P, opts?: StatSyncOptions): Stats | BigIntStats | undefined {
    return this.baseFs.statSync(this.mapToBase(p), opts);
  }

  async fstatPromise(fd: number): Promise<Stats>;
  async fstatPromise(fd: number, opts: {bigint: true}): Promise<BigIntStats>;
  async fstatPromise(fd: number, opts?: {bigint: boolean}): Promise<BigIntStats | Stats>;
  async fstatPromise(fd: number, opts?: {bigint: boolean}) {
    return this.baseFs.fstatPromise(fd, opts);
  }

  fstatSync(fd: number): Stats;
  fstatSync(fd: number, opts: {bigint: true}): BigIntStats;
  fstatSync(fd: number, opts?: {bigint: boolean}): BigIntStats | Stats;
  fstatSync(fd: number, opts?: {bigint: boolean}) {
    return this.baseFs.fstatSync(fd, opts);
  }

  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/51d793492d4c2e372b01257668dcd3afc58d7352/types/node/v16/fs.d.ts#L1042-L1059
  lstatPromise(p: P): Promise<Stats>;
  lstatPromise(p: P, opts: (StatOptions & { bigint?: false | undefined }) | undefined): Promise<Stats>;
  lstatPromise(p: P, opts: StatOptions & { bigint: true }): Promise<BigIntStats>;
  lstatPromise(p: P, opts?: StatOptions): Promise<Stats | BigIntStats> {
    return this.baseFs.lstatPromise(this.mapToBase(p), opts);
  }

  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/51d793492d4c2e372b01257668dcd3afc58d7352/types/node/v16/fs.d.ts#L931-L967
  lstatSync(p: P): Stats;
  lstatSync(p: P, opts?: StatSyncOptions & {bigint?: false | undefined, throwIfNoEntry: false}): Stats | undefined;
  lstatSync(p: P, opts: StatSyncOptions & {bigint: true, throwIfNoEntry: false}): BigIntStats | undefined;
  lstatSync(p: P, opts?: StatSyncOptions & {bigint?: false | undefined}): Stats;
  lstatSync(p: P, opts: StatSyncOptions & {bigint: true}): BigIntStats;
  lstatSync(p: P, opts: StatSyncOptions & { bigint: boolean, throwIfNoEntry?: false | undefined }): Stats | BigIntStats;
  lstatSync(p: P, opts?: StatSyncOptions): Stats | BigIntStats | undefined {
    return this.baseFs.lstatSync(this.mapToBase(p), opts);
  }

  async fchmodPromise(fd: number, mask: number): Promise<void> {
    return this.baseFs.fchmodPromise(fd, mask);
  }

  fchmodSync(fd: number, mask: number): void {
    return this.baseFs.fchmodSync(fd, mask);
  }

  async chmodPromise(p: P, mask: number) {
    return this.baseFs.chmodPromise(this.mapToBase(p), mask);
  }

  chmodSync(p: P, mask: number) {
    return this.baseFs.chmodSync(this.mapToBase(p), mask);
  }

  async fchownPromise(fd: number, uid: number, gid: number): Promise<void> {
    return this.baseFs.fchownPromise(fd, uid, gid);
  }

  fchownSync(fd: number, uid: number, gid: number): void {
    return this.baseFs.fchownSync(fd, uid, gid);
  }

  async chownPromise(p: P, uid: number, gid: number) {
    return this.baseFs.chownPromise(this.mapToBase(p), uid, gid);
  }

  chownSync(p: P, uid: number, gid: number) {
    return this.baseFs.chownSync(this.mapToBase(p), uid, gid);
  }

  async renamePromise(oldP: P, newP: P) {
    return this.baseFs.renamePromise(this.mapToBase(oldP), this.mapToBase(newP));
  }

  renameSync(oldP: P, newP: P) {
    return this.baseFs.renameSync(this.mapToBase(oldP), this.mapToBase(newP));
  }

  async copyFilePromise(sourceP: P, destP: P, flags: number = 0) {
    return this.baseFs.copyFilePromise(this.mapToBase(sourceP), this.mapToBase(destP), flags);
  }

  copyFileSync(sourceP: P, destP: P, flags: number = 0) {
    return this.baseFs.copyFileSync(this.mapToBase(sourceP), this.mapToBase(destP), flags);
  }

  async appendFilePromise(p: FSPath<P>, content: string | Uint8Array, opts?: WriteFileOptions) {
    return this.baseFs.appendFilePromise(this.fsMapToBase(p), content, opts);
  }

  appendFileSync(p: FSPath<P>, content: string | Uint8Array, opts?: WriteFileOptions) {
    return this.baseFs.appendFileSync(this.fsMapToBase(p), content, opts);
  }

  async writeFilePromise(p: FSPath<P>, content: string | NodeJS.ArrayBufferView, opts?: WriteFileOptions) {
    return this.baseFs.writeFilePromise(this.fsMapToBase(p), content, opts);
  }

  writeFileSync(p: FSPath<P>, content: string | NodeJS.ArrayBufferView, opts?: WriteFileOptions) {
    return this.baseFs.writeFileSync(this.fsMapToBase(p), content, opts);
  }

  async unlinkPromise(p: P) {
    return this.baseFs.unlinkPromise(this.mapToBase(p));
  }

  unlinkSync(p: P) {
    return this.baseFs.unlinkSync(this.mapToBase(p));
  }

  async utimesPromise(p: P, atime: Date | string | number, mtime: Date | string | number) {
    return this.baseFs.utimesPromise(this.mapToBase(p), atime, mtime);
  }

  utimesSync(p: P, atime: Date | string | number, mtime: Date | string | number) {
    return this.baseFs.utimesSync(this.mapToBase(p), atime, mtime);
  }

  async lutimesPromise(p: P, atime: Date | string | number, mtime: Date | string | number) {
    return this.baseFs.lutimesPromise(this.mapToBase(p), atime, mtime);
  }

  lutimesSync(p: P, atime: Date | string | number, mtime: Date | string | number) {
    return this.baseFs.lutimesSync(this.mapToBase(p), atime, mtime);
  }

  async mkdirPromise(p: P, opts?: MkdirOptions) {
    return this.baseFs.mkdirPromise(this.mapToBase(p), opts);
  }

  mkdirSync(p: P, opts?: MkdirOptions) {
    return this.baseFs.mkdirSync(this.mapToBase(p), opts);
  }

  async rmdirPromise(p: P, opts?: RmdirOptions) {
    return this.baseFs.rmdirPromise(this.mapToBase(p), opts);
  }

  rmdirSync(p: P, opts?: RmdirOptions) {
    return this.baseFs.rmdirSync(this.mapToBase(p), opts);
  }

  async rmPromise(p: P, opts?: RmOptions) {
    return this.baseFs.rmPromise(this.mapToBase(p), opts);
  }

  rmSync(p: P, opts?: RmOptions) {
    return this.baseFs.rmSync(this.mapToBase(p), opts);
  }

  async linkPromise(existingP: P, newP: P) {
    return this.baseFs.linkPromise(this.mapToBase(existingP), this.mapToBase(newP));
  }

  linkSync(existingP: P, newP: P) {
    return this.baseFs.linkSync(this.mapToBase(existingP), this.mapToBase(newP));
  }

  async symlinkPromise(target: P, p: P, type?: SymlinkType) {
    const mappedP = this.mapToBase(p);

    if (this.pathUtils.isAbsolute(target))
      return this.baseFs.symlinkPromise(this.mapToBase(target), mappedP, type);

    const mappedAbsoluteTarget = this.mapToBase(this.pathUtils.join(this.pathUtils.dirname(p), target));
    const mappedTarget = this.baseFs.pathUtils.relative(this.baseFs.pathUtils.dirname(mappedP), mappedAbsoluteTarget);

    return this.baseFs.symlinkPromise(mappedTarget, mappedP, type);
  }

  symlinkSync(target: P, p: P, type?: SymlinkType) {
    const mappedP = this.mapToBase(p);

    if (this.pathUtils.isAbsolute(target))
      return this.baseFs.symlinkSync(this.mapToBase(target), mappedP, type);

    const mappedAbsoluteTarget = this.mapToBase(this.pathUtils.join(this.pathUtils.dirname(p), target));
    const mappedTarget = this.baseFs.pathUtils.relative(this.baseFs.pathUtils.dirname(mappedP), mappedAbsoluteTarget);

    return this.baseFs.symlinkSync(mappedTarget, mappedP, type);
  }

  async readFilePromise(p: FSPath<P>, encoding?: null): Promise<Buffer>;
  async readFilePromise(p: FSPath<P>, encoding: BufferEncoding): Promise<string>;
  async readFilePromise(p: FSPath<P>, encoding?: BufferEncoding | null): Promise<Buffer | string>;
  async readFilePromise(p: FSPath<P>, encoding?: BufferEncoding | null) {
    return this.baseFs.readFilePromise(this.fsMapToBase(p), encoding);
  }

  readFileSync(p: FSPath<P>, encoding?: null): Buffer;
  readFileSync(p: FSPath<P>, encoding: BufferEncoding): string;
  readFileSync(p: FSPath<P>, encoding?: BufferEncoding | null): Buffer | string;
  readFileSync(p: FSPath<P>, encoding?: BufferEncoding | null) {
    return this.baseFs.readFileSync(this.fsMapToBase(p), encoding);
  }

  readdirPromise(p: P, opts?: null): Promise<Array<Filename>>;
  readdirPromise(p: P, opts: {recursive?: false, withFileTypes: true}): Promise<Array<DirentNoPath>>;
  readdirPromise(p: P, opts: {recursive?: false, withFileTypes?: false}): Promise<Array<Filename>>;
  readdirPromise(p: P, opts: {recursive?: false, withFileTypes: boolean}): Promise<Array<DirentNoPath | Filename>>;
  readdirPromise(p: P, opts: {recursive: true, withFileTypes: true}): Promise<Array<Dirent<P>>>;
  readdirPromise(p: P, opts: {recursive: true, withFileTypes?: false}): Promise<Array<P>>;
  readdirPromise(p: P, opts: {recursive: true, withFileTypes: boolean}): Promise<Array<Dirent<P> | P>>;
  readdirPromise(p: P, opts: {recursive: boolean, withFileTypes: true}): Promise<Array<Dirent<P> | DirentNoPath>>;
  readdirPromise(p: P, opts: {recursive: boolean, withFileTypes?: false}): Promise<Array<P>>;
  readdirPromise(p: P, opts: {recursive: boolean, withFileTypes: boolean}): Promise<Array<Dirent<P> | DirentNoPath | P>>;
  readdirPromise(p: P, opts?: ReaddirOptions | null): Promise<Array<Dirent<P> | DirentNoPath | P | Filename>> {
    return this.baseFs.readdirPromise(this.mapToBase(p), opts as any);
  }

  readdirSync(p: P, opts?: null): Array<Filename>;
  readdirSync(p: P, opts: {recursive?: false, withFileTypes: true}): Array<DirentNoPath>;
  readdirSync(p: P, opts: {recursive?: false, withFileTypes?: false}): Array<Filename>;
  readdirSync(p: P, opts: {recursive?: false, withFileTypes: boolean}): Array<DirentNoPath | Filename>;
  readdirSync(p: P, opts: {recursive: true, withFileTypes: true}): Array<Dirent<P>>;
  readdirSync(p: P, opts: {recursive: true, withFileTypes?: false}): Array<P>;
  readdirSync(p: P, opts: {recursive: true, withFileTypes: boolean}): Array<Dirent<P> | P>;
  readdirSync(p: P, opts: {recursive: boolean, withFileTypes: true}): Array<Dirent<P> | DirentNoPath>;
  readdirSync(p: P, opts: {recursive: boolean, withFileTypes?: false}): Array<P>;
  readdirSync(p: P, opts: {recursive: boolean, withFileTypes: boolean}): Array<Dirent<P> | DirentNoPath | P>;
  readdirSync(p: P, opts?: ReaddirOptions | null): Array<Dirent<P> | DirentNoPath | P | Filename> {
    return this.baseFs.readdirSync(this.mapToBase(p), opts as any);
  }

  async readlinkPromise(p: P) {
    return this.mapFromBase(await this.baseFs.readlinkPromise(this.mapToBase(p)));
  }

  readlinkSync(p: P) {
    return this.mapFromBase(this.baseFs.readlinkSync(this.mapToBase(p)));
  }

  async truncatePromise(p: P, len?: number) {
    return this.baseFs.truncatePromise(this.mapToBase(p), len);
  }

  truncateSync(p: P, len?: number) {
    return this.baseFs.truncateSync(this.mapToBase(p), len);
  }

  async ftruncatePromise(fd: number, len?: number): Promise<void> {
    return this.baseFs.ftruncatePromise(fd, len);
  }

  ftruncateSync(fd: number, len?: number): void {
    return this.baseFs.ftruncateSync(fd, len);
  }

  watch(p: P, cb?: WatchCallback): Watcher;
  watch(p: P, opts: WatchOptions, cb?: WatchCallback): Watcher;
  watch(p: P, a?: WatchOptions | WatchCallback, b?: WatchCallback) {
    return this.baseFs.watch(
      this.mapToBase(p),
      // @ts-expect-error
      a,
      b,
    );
  }

  watchFile(p: P, cb: WatchFileCallback): StatWatcher;
  watchFile(p: P, opts: WatchFileOptions, cb: WatchFileCallback): StatWatcher;
  watchFile(p: P, a: WatchFileOptions | WatchFileCallback, b?: WatchFileCallback) {
    return this.baseFs.watchFile(
      this.mapToBase(p),
      // @ts-expect-error
      a,
      b,
    );
  }

  unwatchFile(p: P, cb?: WatchFileCallback) {
    return this.baseFs.unwatchFile(this.mapToBase(p), cb);
  }

  private fsMapToBase(p: FSPath<P>) {
    if (typeof p === `number`) {
      return p;
    } else {
      return this.mapToBase(p);
    }
  }
}
