import {Stats, BigIntStats}                                                                                                                                                                 from 'fs';

import {CreateReadStreamOptions, CreateWriteStreamOptions, FakeFS, ExtractHintOptions, WatchFileCallback, WatchFileOptions, StatWatcher, Dir, OpendirOptions, ReaddirOptions, DirentNoPath} from './FakeFS';
import {Dirent, SymlinkType, StatSyncOptions, StatOptions}                                                                                                                                  from './FakeFS';
import {MkdirOptions, RmdirOptions, WriteFileOptions, WatchCallback, WatchOptions, Watcher}                                                                                                 from './FakeFS';
import {FSPath, Filename, PortablePath, ppath}                                                                                                                                              from './path';

export class NoopFS extends FakeFS<PortablePath> {
  private readonly baseFs: FakeFS<PortablePath>;

  constructor({baseFs}: {baseFs: FakeFS<PortablePath>}) {
    super(ppath);

    this.baseFs = baseFs;
  }

  getExtractHint(hints: ExtractHintOptions) {
    return this.baseFs.getExtractHint(hints);
  }

  resolve(path: PortablePath)  {
    return this.baseFs.resolve(path);
  }

  getRealPath() {
    return this.baseFs.getRealPath();
  }

  async openPromise(p: PortablePath, flags: string, mode?: number) {
    return this.baseFs.openPromise(p, flags, mode);
  }

  openSync(p: PortablePath, flags: string, mode?: number) {
    return this.baseFs.openSync(p, flags, mode);
  }

  async opendirPromise(p: PortablePath, opts?: OpendirOptions): Promise<Dir<PortablePath>> {
    return Object.assign(await this.baseFs.opendirPromise(p, opts), {path: p});
  }

  opendirSync(p: PortablePath, opts?: OpendirOptions): Dir<PortablePath> {
    return Object.assign(this.baseFs.opendirSync(p, opts), {path: p});
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

  createReadStream(p: PortablePath | null, opts?: CreateReadStreamOptions) {
    return this.baseFs.createReadStream(p !== null ? p : p, opts);
  }

  createWriteStream(p: PortablePath | null, opts?: CreateWriteStreamOptions) {
    return this.baseFs.createWriteStream(p !== null ? p : p, opts);
  }

  async realpathPromise(p: PortablePath) {
    return await this.baseFs.realpathPromise(p);
  }

  realpathSync(p: PortablePath) {
    return this.baseFs.realpathSync(p);
  }

  async existsPromise(p: PortablePath) {
    return this.baseFs.existsPromise(p);
  }

  existsSync(p: PortablePath) {
    return this.baseFs.existsSync(p);
  }

  accessSync(p: PortablePath, mode?: number) {
    return this.baseFs.accessSync(p, mode);
  }

  async accessPromise(p: PortablePath, mode?: number) {
    return this.baseFs.accessPromise(p, mode);
  }

  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/51d793492d4c2e372b01257668dcd3afc58d7352/types/node/v16/fs.d.ts#L1042-L1059
  async statPromise(p: PortablePath): Promise<Stats>;
  async statPromise(p: PortablePath, opts: (StatOptions & { bigint?: false | undefined }) | undefined): Promise<Stats>;
  async statPromise(p: PortablePath, opts: StatOptions & { bigint: true }): Promise<BigIntStats>;
  async statPromise(p: PortablePath, opts?: StatOptions): Promise<Stats | BigIntStats> {
    return this.baseFs.statPromise(p, opts);
  }

  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/51d793492d4c2e372b01257668dcd3afc58d7352/types/node/v16/fs.d.ts#L931-L967
  statSync(p: PortablePath): Stats;
  statSync(p: PortablePath, opts?: StatSyncOptions & {bigint?: false | undefined, throwIfNoEntry: false}): Stats | undefined;
  statSync(p: PortablePath, opts: StatSyncOptions & {bigint: true, throwIfNoEntry: false}): BigIntStats | undefined;
  statSync(p: PortablePath, opts?: StatSyncOptions & {bigint?: false | undefined}): Stats;
  statSync(p: PortablePath, opts: StatSyncOptions & {bigint: true}): BigIntStats;
  statSync(p: PortablePath, opts: StatSyncOptions & {bigint: boolean, throwIfNoEntry?: false | undefined}): Stats | BigIntStats;
  statSync(p: PortablePath, opts?: StatSyncOptions): Stats | BigIntStats | undefined {
    return this.baseFs.statSync(p, opts);
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
  lstatPromise(p: PortablePath): Promise<Stats>;
  lstatPromise(p: PortablePath, opts: (StatOptions & { bigint?: false | undefined }) | undefined): Promise<Stats>;
  lstatPromise(p: PortablePath, opts: StatOptions & { bigint: true }): Promise<BigIntStats>;
  lstatPromise(p: PortablePath, opts?: StatOptions): Promise<Stats | BigIntStats> {
    return this.baseFs.lstatPromise(p, opts);
  }

  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/51d793492d4c2e372b01257668dcd3afc58d7352/types/node/v16/fs.d.ts#L931-L967
  lstatSync(p: PortablePath): Stats;
  lstatSync(p: PortablePath, opts?: StatSyncOptions & {bigint?: false | undefined, throwIfNoEntry: false}): Stats | undefined;
  lstatSync(p: PortablePath, opts: StatSyncOptions & {bigint: true, throwIfNoEntry: false}): BigIntStats | undefined;
  lstatSync(p: PortablePath, opts?: StatSyncOptions & {bigint?: false | undefined}): Stats;
  lstatSync(p: PortablePath, opts: StatSyncOptions & {bigint: true}): BigIntStats;
  lstatSync(p: PortablePath, opts: StatSyncOptions & { bigint: boolean, throwIfNoEntry?: false | undefined }): Stats | BigIntStats;
  lstatSync(p: PortablePath, opts?: StatSyncOptions): Stats | BigIntStats | undefined {
    return this.baseFs.lstatSync(p, opts);
  }

  async fchmodPromise(fd: number, mask: number): Promise<void> {
    return this.baseFs.fchmodPromise(fd, mask);
  }

  fchmodSync(fd: number, mask: number): void {
    return this.baseFs.fchmodSync(fd, mask);
  }

  async chmodPromise(p: PortablePath, mask: number) {
    return this.baseFs.chmodPromise(p, mask);
  }

  chmodSync(p: PortablePath, mask: number) {
    return this.baseFs.chmodSync(p, mask);
  }

  async fchownPromise(fd: number, uid: number, gid: number): Promise<void> {
    return this.baseFs.fchownPromise(fd, uid, gid);
  }

  fchownSync(fd: number, uid: number, gid: number): void {
    return this.baseFs.fchownSync(fd, uid, gid);
  }

  async chownPromise(p: PortablePath, uid: number, gid: number) {
    return this.baseFs.chownPromise(p, uid, gid);
  }

  chownSync(p: PortablePath, uid: number, gid: number) {
    return this.baseFs.chownSync(p, uid, gid);
  }

  async renamePromise(oldP: PortablePath, newP: PortablePath) {
    return this.baseFs.renamePromise(oldP, newP);
  }

  renameSync(oldP: PortablePath, newP: PortablePath) {
    return this.baseFs.renameSync(oldP, newP);
  }

  async copyFilePromise(sourceP: PortablePath, destP: PortablePath, flags: number = 0) {
    return this.baseFs.copyFilePromise(sourceP, destP, flags);
  }

  copyFileSync(sourceP: PortablePath, destP: PortablePath, flags: number = 0) {
    return this.baseFs.copyFileSync(sourceP, destP, flags);
  }

  async appendFilePromise(p: FSPath<PortablePath>, content: string | Uint8Array, opts?: WriteFileOptions) {
    return this.baseFs.appendFilePromise(p, content, opts);
  }

  appendFileSync(p: FSPath<PortablePath>, content: string | Uint8Array, opts?: WriteFileOptions) {
    return this.baseFs.appendFileSync(p, content, opts);
  }

  async writeFilePromise(p: FSPath<PortablePath>, content: string | NodeJS.ArrayBufferView, opts?: WriteFileOptions) {
    return this.baseFs.writeFilePromise(p, content, opts);
  }

  writeFileSync(p: FSPath<PortablePath>, content: string | NodeJS.ArrayBufferView, opts?: WriteFileOptions) {
    return this.baseFs.writeFileSync(p, content, opts);
  }

  async unlinkPromise(p: PortablePath) {
    return this.baseFs.unlinkPromise(p);
  }

  unlinkSync(p: PortablePath) {
    return this.baseFs.unlinkSync(p);
  }

  async utimesPromise(p: PortablePath, atime: Date | string | number, mtime: Date | string | number) {
    return this.baseFs.utimesPromise(p, atime, mtime);
  }

  utimesSync(p: PortablePath, atime: Date | string | number, mtime: Date | string | number) {
    return this.baseFs.utimesSync(p, atime, mtime);
  }

  async lutimesPromise(p: PortablePath, atime: Date | string | number, mtime: Date | string | number) {
    return this.baseFs.lutimesPromise(p, atime, mtime);
  }

  lutimesSync(p: PortablePath, atime: Date | string | number, mtime: Date | string | number) {
    return this.baseFs.lutimesSync(p, atime, mtime);
  }

  async mkdirPromise(p: PortablePath, opts?: MkdirOptions) {
    return this.baseFs.mkdirPromise(p, opts);
  }

  mkdirSync(p: PortablePath, opts?: MkdirOptions) {
    return this.baseFs.mkdirSync(p, opts);
  }

  async rmdirPromise(p: PortablePath, opts?: RmdirOptions) {
    return this.baseFs.rmdirPromise(p, opts);
  }

  rmdirSync(p: PortablePath, opts?: RmdirOptions) {
    return this.baseFs.rmdirSync(p, opts);
  }

  async linkPromise(existingP: PortablePath, newP: PortablePath) {
    return this.baseFs.linkPromise(existingP, newP);
  }

  linkSync(existingP: PortablePath, newP: PortablePath) {
    return this.baseFs.linkSync(existingP, newP);
  }

  async symlinkPromise(target: PortablePath, p: PortablePath, type?: SymlinkType) {
    return this.baseFs.symlinkPromise(target, p, type);
  }

  symlinkSync(target: PortablePath, p: PortablePath, type?: SymlinkType) {
    return this.baseFs.symlinkSync(target, p, type);
  }

  async readFilePromise(p: FSPath<PortablePath>, encoding?: null): Promise<Buffer>;
  async readFilePromise(p: FSPath<PortablePath>, encoding: BufferEncoding): Promise<string>;
  async readFilePromise(p: FSPath<PortablePath>, encoding?: BufferEncoding | null): Promise<Buffer | string>;
  async readFilePromise(p: FSPath<PortablePath>, encoding?: BufferEncoding | null) {
    return this.baseFs.readFilePromise(p, encoding);
  }

  readFileSync(p: FSPath<PortablePath>, encoding?: null): Buffer;
  readFileSync(p: FSPath<PortablePath>, encoding: BufferEncoding): string;
  readFileSync(p: FSPath<PortablePath>, encoding?: BufferEncoding | null): Buffer | string;
  readFileSync(p: FSPath<PortablePath>, encoding?: BufferEncoding | null) {
    return this.baseFs.readFileSync(p, encoding);
  }

  readdirPromise(p: PortablePath, opts?: null): Promise<Array<Filename>>;
  readdirPromise(p: PortablePath, opts: {recursive?: false, withFileTypes: true}): Promise<Array<DirentNoPath>>;
  readdirPromise(p: PortablePath, opts: {recursive?: false, withFileTypes?: false}): Promise<Array<Filename>>;
  readdirPromise(p: PortablePath, opts: {recursive?: false, withFileTypes: boolean}): Promise<Array<DirentNoPath | Filename>>;
  readdirPromise(p: PortablePath, opts: {recursive: true, withFileTypes: true}): Promise<Array<Dirent<PortablePath>>>;
  readdirPromise(p: PortablePath, opts: {recursive: true, withFileTypes?: false}): Promise<Array<PortablePath>>;
  readdirPromise(p: PortablePath, opts: {recursive: true, withFileTypes: boolean}): Promise<Array<Dirent<PortablePath> | PortablePath>>;
  readdirPromise(p: PortablePath, opts: {recursive: boolean, withFileTypes: true}): Promise<Array<Dirent<PortablePath> | DirentNoPath>>;
  readdirPromise(p: PortablePath, opts: {recursive: boolean, withFileTypes?: false}): Promise<Array<PortablePath>>;
  readdirPromise(p: PortablePath, opts: {recursive: boolean, withFileTypes: boolean}): Promise<Array<Dirent<PortablePath> | DirentNoPath | PortablePath>>;
  readdirPromise(p: PortablePath, opts?: ReaddirOptions | null): Promise<Array<Dirent<PortablePath> | DirentNoPath | PortablePath | Filename>> {
    return this.baseFs.readdirPromise(p, opts as any);
  }

  readdirSync(p: PortablePath, opts?: null): Array<Filename>;
  readdirSync(p: PortablePath, opts: {recursive?: false, withFileTypes: true}): Array<DirentNoPath>;
  readdirSync(p: PortablePath, opts: {recursive?: false, withFileTypes?: false}): Array<Filename>;
  readdirSync(p: PortablePath, opts: {recursive?: false, withFileTypes: boolean}): Array<DirentNoPath | Filename>;
  readdirSync(p: PortablePath, opts: {recursive: true, withFileTypes: true}): Array<Dirent<PortablePath>>;
  readdirSync(p: PortablePath, opts: {recursive: true, withFileTypes?: false}): Array<PortablePath>;
  readdirSync(p: PortablePath, opts: {recursive: true, withFileTypes: boolean}): Array<Dirent<PortablePath> | PortablePath>;
  readdirSync(p: PortablePath, opts: {recursive: boolean, withFileTypes: true}): Array<Dirent<PortablePath> | DirentNoPath>;
  readdirSync(p: PortablePath, opts: {recursive: boolean, withFileTypes?: false}): Array<PortablePath>;
  readdirSync(p: PortablePath, opts: {recursive: boolean, withFileTypes: boolean}): Array<Dirent<PortablePath> | DirentNoPath | PortablePath>;
  readdirSync(p: PortablePath, opts?: ReaddirOptions | null): Array<Dirent<PortablePath> | DirentNoPath | PortablePath | Filename> {
    return this.baseFs.readdirSync(p, opts as any);
  }

  async readlinkPromise(p: PortablePath) {
    return await this.baseFs.readlinkPromise(p);
  }

  readlinkSync(p: PortablePath) {
    return this.baseFs.readlinkSync(p);
  }

  async truncatePromise(p: PortablePath, len?: number) {
    return this.baseFs.truncatePromise(p, len);
  }

  truncateSync(p: PortablePath, len?: number) {
    return this.baseFs.truncateSync(p, len);
  }

  async ftruncatePromise(fd: number, len?: number): Promise<void> {
    return this.baseFs.ftruncatePromise(fd, len);
  }

  ftruncateSync(fd: number, len?: number): void {
    return this.baseFs.ftruncateSync(fd, len);
  }

  watch(p: PortablePath, cb?: WatchCallback): Watcher;
  watch(p: PortablePath, opts: WatchOptions, cb?: WatchCallback): Watcher;
  watch(p: PortablePath, a?: WatchOptions | WatchCallback, b?: WatchCallback) {
    return this.baseFs.watch(
      p,
      // @ts-expect-error
      a,
      b,
    );
  }

  watchFile(p: PortablePath, cb: WatchFileCallback): StatWatcher;
  watchFile(p: PortablePath, opts: WatchFileOptions, cb: WatchFileCallback): StatWatcher;
  watchFile(p: PortablePath, a: WatchFileOptions | WatchFileCallback, b?: WatchFileCallback) {
    return this.baseFs.watchFile(
      p,
      // @ts-expect-error
      a,
      b,
    );
  }

  unwatchFile(p: PortablePath, cb?: WatchFileCallback) {
    return this.baseFs.unwatchFile(p, cb);
  }
}
