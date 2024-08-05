import {createHash}                                      from 'crypto';
import {EventEmitter}                                    from 'events';
import {Dirent as NodeDirent, ReadStream}                from 'fs';
import {Stats as NodeStats, WriteStream}                 from 'fs';
import {NoParamCallback, BigIntStats as NodeBigIntStats} from 'fs';
import {EOL}                                             from 'os';

import {copyPromise, LinkStrategy}                       from './algorithms/copyPromise';
import {FSPath, Path, PortablePath, PathUtils, Filename} from './path';
import {convertPath, ppath}                              from './path';

export type BufferEncodingOrBuffer = BufferEncoding | 'buffer';

export type Stats = NodeStats & {
  crc?: number;
};
export type BigIntStats = NodeBigIntStats & {
  crc?: number;
};

export type Dirent<T extends Path> = Omit<NodeDirent, 'name' | 'path'> & {
  name: Filename;
  path: T;
};

export type DirentNoPath = Omit<NodeDirent, 'name' | 'path'> & {
  name: Filename;
};

export type Dir<P extends Path> = {
  readonly path: P;

  [Symbol.asyncIterator](): AsyncIterableIterator<DirentNoPath>;

  close(): Promise<void>;
  close(cb: NoParamCallback): void;

  closeSync(): void;

  read(): Promise<DirentNoPath | null>;
  read(cb: (err: NodeJS.ErrnoException | null, dirent: DirentNoPath | null) => void): void;

  readSync(): DirentNoPath | null;
};

export type OpendirOptions = Partial<{
  bufferSize: number;
  recursive: boolean;
}>;

export type ReaddirOptions = Partial<{
  recursive: boolean;
  withFileTypes: boolean;
}>;

export type CreateReadStreamOptions = Partial<{
  encoding: BufferEncoding;
  fd: number;
}>;

export type CreateWriteStreamOptions = Partial<{
  encoding: BufferEncoding;
  fd: number;
  flags: 'a';
}>;

export type MkdirOptions = Partial<{
  recursive: boolean;
  mode: number;
}>;

export type RmdirOptions = Partial<{
  maxRetries: number;
  retryDelay: number;
  /** @deprecated Use `rm` instead of `rmdir` */
  recursive: boolean;
}>;

export type RmOptions = Partial<{
  maxRetries: number;
  retryDelay: number;
  force: boolean;
  recursive: boolean;
}>;

export type WriteFileOptions = Partial<{
  encoding: BufferEncoding;
  mode: number;
  flag: string;
}> | BufferEncoding;

export type WatchOptions = Partial<{
  persistent: boolean;
  recursive: boolean;
  encoding: BufferEncodingOrBuffer;
}> | BufferEncodingOrBuffer;

export type WatchFileOptions = Partial<{
  bigint: boolean;
  persistent: boolean;
  interval: number;
}>;

export type ChangeFileOptions = Partial<{
  automaticNewlines: boolean;
  mode: number;
}>;

export type WatchCallback = (
  eventType: string,
  filename: string,
) => void;

export type Watcher = {
  on: any;
  close: () => void;
};

export type WatchFileCallback = (
  current: Stats,
  previous: Stats,
) => void;

export type StatWatcher = EventEmitter & {
  ref: () => StatWatcher;
  unref: () => StatWatcher;
};

export type ExtractHintOptions = {
  relevantExtensions: Set<string>;
};

export type SymlinkType = 'file' | 'dir' | 'junction';

export interface StatOptions {
  bigint?: boolean | undefined;
}

export interface StatSyncOptions extends StatOptions {
  throwIfNoEntry?: boolean | undefined;
}

export abstract class FakeFS<P extends Path> {
  public readonly pathUtils: PathUtils<P>;

  protected constructor(pathUtils: PathUtils<P>) {
    this.pathUtils =  pathUtils;
  }

  /**
   * @deprecated: Moved to jsInstallUtils
   */
  abstract getExtractHint(hints: ExtractHintOptions): boolean;

  abstract getRealPath(): P;

  abstract resolve(p: P): P;

  abstract opendirPromise(p: P, opts?: OpendirOptions): Promise<Dir<P>>;
  abstract opendirSync(p: P, opts?: OpendirOptions): Dir<P>;

  abstract openPromise(p: P, flags: string, mode?: number): Promise<number>;
  abstract openSync(p: P, flags: string, mode?: number): number;

  abstract readPromise(fd: number, buffer: Buffer, offset?: number, length?: number, position?: number | null): Promise<number>;
  abstract readSync(fd: number, buffer: Buffer, offset?: number, length?: number, position?: number | null): number;

  abstract writePromise(fd: number, buffer: Buffer, offset?: number, length?: number, position?: number): Promise<number>;
  abstract writePromise(fd: number, buffer: string, position?: number): Promise<number>;
  abstract writeSync(fd: number, buffer: Buffer, offset?: number, length?: number, position?: number): number;
  abstract writeSync(fd: number, buffer: string, position?: number): number;

  abstract closePromise(fd: number): Promise<void>;
  abstract closeSync(fd: number): void;

  abstract createWriteStream(p: P | null, opts?: CreateWriteStreamOptions): WriteStream;
  abstract createReadStream(p: P | null, opts?: CreateReadStreamOptions): ReadStream;

  abstract realpathPromise(p: P): Promise<P>;
  abstract realpathSync(p: P): P;

  abstract readdirPromise(p: P, opts?: null): Promise<Array<Filename>>;
  abstract readdirPromise(p: P, opts: {recursive?: false, withFileTypes: true}): Promise<Array<DirentNoPath>>;
  abstract readdirPromise(p: P, opts: {recursive?: false, withFileTypes?: false}): Promise<Array<Filename>>;
  abstract readdirPromise(p: P, opts: {recursive?: false, withFileTypes: boolean}): Promise<Array<DirentNoPath | Filename>>;
  abstract readdirPromise(p: P, opts: {recursive: true, withFileTypes: true}): Promise<Array<Dirent<P>>>;
  abstract readdirPromise(p: P, opts: {recursive: true, withFileTypes?: false}): Promise<Array<P>>;
  abstract readdirPromise(p: P, opts: {recursive: true, withFileTypes: boolean}): Promise<Array<Dirent<P> | P>>;
  abstract readdirPromise(p: P, opts: {recursive: boolean, withFileTypes: true}): Promise<Array<Dirent<P> | DirentNoPath>>;
  abstract readdirPromise(p: P, opts: {recursive: boolean, withFileTypes?: false}): Promise<Array<P>>;
  abstract readdirPromise(p: P, opts: {recursive: boolean, withFileTypes: boolean}): Promise<Array<Dirent<P> | DirentNoPath | P>>;
  abstract readdirPromise(p: P, opts?: ReaddirOptions | null): Promise<Array<Dirent<P> | DirentNoPath | P>>;

  abstract readdirSync(p: P, opts?: null): Array<Filename>;
  abstract readdirSync(p: P, opts: {recursive?: false, withFileTypes: true}): Array<DirentNoPath>;
  abstract readdirSync(p: P, opts: {recursive?: false, withFileTypes?: false}): Array<Filename>;
  abstract readdirSync(p: P, opts: {recursive?: false, withFileTypes: boolean}): Array<DirentNoPath | Filename>;
  abstract readdirSync(p: P, opts: {recursive: true, withFileTypes: true}): Array<Dirent<P>>;
  abstract readdirSync(p: P, opts: {recursive: true, withFileTypes?: false}): Array<P>;
  abstract readdirSync(p: P, opts: {recursive: true, withFileTypes: boolean}): Array<Dirent<P> | P>;
  abstract readdirSync(p: P, opts: {recursive: boolean, withFileTypes: true}): Array<Dirent<P> | DirentNoPath>;
  abstract readdirSync(p: P, opts: {recursive: boolean, withFileTypes?: false}): Array<P>;
  abstract readdirSync(p: P, opts: {recursive: boolean, withFileTypes: boolean}): Array<Dirent<P> | DirentNoPath | P>;
  abstract readdirSync(p: P, opts?: ReaddirOptions | null): Array<Dirent<P> | DirentNoPath | P>;

  abstract existsPromise(p: P): Promise<boolean>;
  abstract existsSync(p: P): boolean;

  abstract accessPromise(p: P, mode?: number): Promise<void>;
  abstract accessSync(p: P, mode?: number): void;

  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/51d793492d4c2e372b01257668dcd3afc58d7352/types/node/v16/fs.d.ts#L1042-L1059
  abstract statPromise(p: P): Promise<Stats>;
  abstract statPromise(p: P, opts: (StatOptions & { bigint?: false | undefined }) | undefined): Promise<Stats>;
  abstract statPromise(p: P, opts: StatOptions & { bigint: true }): Promise<BigIntStats>;
  abstract statPromise(p: P, opts?: StatOptions): Promise<Stats | BigIntStats>;

  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/51d793492d4c2e372b01257668dcd3afc58d7352/types/node/v16/fs.d.ts#L931-L967
  abstract statSync(p: P): Stats;
  abstract statSync(p: P, opts?: StatSyncOptions & {bigint?: false | undefined, throwIfNoEntry: false}): Stats | undefined;
  abstract statSync(p: P, opts: StatSyncOptions & {bigint: true, throwIfNoEntry: false}): BigIntStats | undefined;
  abstract statSync(p: P, opts?: StatSyncOptions & {bigint?: false | undefined}): Stats;
  abstract statSync(p: P, opts: StatSyncOptions & {bigint: true}): BigIntStats;
  abstract statSync(p: P, opts: StatSyncOptions & {bigint: boolean, throwIfNoEntry?: false | undefined}): Stats | BigIntStats;
  abstract statSync(p: P, opts?: StatSyncOptions): Stats | BigIntStats | undefined;

  abstract fstatPromise(fd: number): Promise<Stats>;
  abstract fstatPromise(fd: number, opts: {bigint: true}): Promise<BigIntStats>;
  abstract fstatPromise(fd: number, opts?: {bigint?: boolean}): Promise<BigIntStats | Stats>;
  abstract fstatSync(fd: number): Stats;
  abstract fstatSync(fd: number, opts: {bigint: true}): BigIntStats;
  abstract fstatSync(fd: number, opts?: {bigint?: boolean}): BigIntStats | Stats;

  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/51d793492d4c2e372b01257668dcd3afc58d7352/types/node/v16/fs.d.ts#L1042-L1059
  abstract lstatPromise(p: P): Promise<Stats>;
  abstract lstatPromise(p: P, opts: (StatOptions & { bigint?: false | undefined }) | undefined): Promise<Stats>;
  abstract lstatPromise(p: P, opts: StatOptions & { bigint: true }): Promise<BigIntStats>;
  abstract lstatPromise(p: P, opts?: StatOptions): Promise<Stats | BigIntStats>;

  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/51d793492d4c2e372b01257668dcd3afc58d7352/types/node/v16/fs.d.ts#L931-L967
  abstract lstatSync(p: P): Stats;
  abstract lstatSync(p: P, opts?: StatSyncOptions & {bigint?: false | undefined, throwIfNoEntry: false}): Stats | undefined;
  abstract lstatSync(p: P, opts: StatSyncOptions & {bigint: true, throwIfNoEntry: false}): BigIntStats | undefined;
  abstract lstatSync(p: P, opts?: StatSyncOptions & {bigint?: false | undefined}): Stats;
  abstract lstatSync(p: P, opts: StatSyncOptions & {bigint: true}): BigIntStats;
  abstract lstatSync(p: P, opts: StatSyncOptions & { bigint: boolean, throwIfNoEntry?: false | undefined }): Stats | BigIntStats;
  abstract lstatSync(p: P, opts?: StatSyncOptions): Stats | BigIntStats | undefined;

  abstract chmodPromise(p: P, mask: number): Promise<void>;
  abstract chmodSync(p: P, mask: number): void;
  abstract fchmodPromise(fd: number, mask: number): Promise<void>;
  abstract fchmodSync(fd: number, mask: number): void;

  abstract fchownPromise(fd: number, uid: number, gid: number): Promise<void>;
  abstract fchownSync(fd: number, uid: number, gid: number): void;

  abstract chownPromise(p: P, uid: number, gid: number): Promise<void>;
  abstract chownSync(p: P, uid: number, gid: number): void;

  abstract mkdirPromise(p: P, opts?: MkdirOptions): Promise<string | undefined>;
  abstract mkdirSync(p: P, opts?: MkdirOptions): string | undefined;

  abstract rmdirPromise(p: P, opts?: RmdirOptions): Promise<void>;
  abstract rmdirSync(p: P, opts?: RmdirOptions): void;

  abstract rmPromise(p: P, opts?: RmOptions): Promise<void>;
  abstract rmSync(p: P, opts?: RmOptions): void;

  abstract linkPromise(existingP: P, newP: P): Promise<void>;
  abstract linkSync(existingP: P, newP: P): void;

  abstract symlinkPromise(target: P, p: P, type?: SymlinkType): Promise<void>;
  abstract symlinkSync(target: P, p: P, type?: SymlinkType): void;

  abstract renamePromise(oldP: P, newP: P): Promise<void>;
  abstract renameSync(oldP: P, newP: P): void;

  abstract copyFilePromise(sourceP: P, destP: P, flags?: number): Promise<void>;
  abstract copyFileSync(sourceP: P, destP: P, flags?: number): void;

  abstract appendFilePromise(p: FSPath<P>, content: string | Uint8Array, opts?: WriteFileOptions): Promise<void>;
  abstract appendFileSync(p: FSPath<P>, content: string | Uint8Array, opts?: WriteFileOptions): void;

  abstract writeFilePromise(p: FSPath<P>, content: string | NodeJS.ArrayBufferView, opts?: WriteFileOptions): Promise<void>;
  abstract writeFileSync(p: FSPath<P>, content: string | NodeJS.ArrayBufferView, opts?: WriteFileOptions): void;

  abstract unlinkPromise(p: P): Promise<void>;
  abstract unlinkSync(p: P): void;

  abstract utimesPromise(p: P, atime: Date | string | number, mtime: Date | string | number): Promise<void>;
  abstract utimesSync(p: P, atime: Date | string | number, mtime: Date | string | number): void;

  abstract lutimesPromise(p: P, atime: Date | string | number, mtime: Date | string | number): Promise<void>;
  abstract lutimesSync(p: P, atime: Date | string | number, mtime: Date | string | number): void;

  abstract readFilePromise(p: FSPath<P>, encoding?: null): Promise<Buffer>;
  abstract readFilePromise(p: FSPath<P>, encoding: BufferEncoding): Promise<string>;
  abstract readFilePromise(p: FSPath<P>, encoding?: BufferEncoding | null): Promise<Buffer | string>;

  abstract readFileSync(p: FSPath<P>, encoding?: null): Buffer;
  abstract readFileSync(p: FSPath<P>, encoding: BufferEncoding): string;
  abstract readFileSync(p: FSPath<P>, encoding?: BufferEncoding | null): Buffer | string;

  abstract readlinkPromise(p: P): Promise<P>;
  abstract readlinkSync(p: P): P;

  abstract ftruncatePromise(fd: number, len?: number): Promise<void>;
  abstract ftruncateSync(fd: number, len?: number): void;

  abstract truncatePromise(p: P, len?: number): Promise<void>;
  abstract truncateSync(p: P, len?: number): void;

  abstract watch(p: P, cb?: WatchCallback): Watcher;
  abstract watch(p: P, opts: WatchOptions, cb?: WatchCallback): Watcher;

  abstract watchFile(p: P, cb: WatchFileCallback): StatWatcher;
  abstract watchFile(p: P, opts: WatchFileOptions, cb: WatchFileCallback): StatWatcher;

  abstract unwatchFile(p: P, cb?: WatchFileCallback): void;

  async * genTraversePromise(init: P, {stableSort = false}: {stableSort?: boolean} = {}) {
    const stack = [init];

    while (stack.length > 0) {
      const p = stack.shift()!;
      const entry = await this.lstatPromise(p);

      if (entry.isDirectory()) {
        const entries = await this.readdirPromise(p);
        if (stableSort) {
          for (const entry of entries.sort()) {
            stack.push(this.pathUtils.join(p, entry));
          }
        } else {
          throw new Error(`Not supported`);
        }
      } else {
        yield p;
      }
    }
  }

  async checksumFilePromise(path: P, {algorithm = `sha512`}: {algorithm?: string} = {}) {
    const fd = await this.openPromise(path, `r`);

    try {
      const CHUNK_SIZE = 65536;
      const chunk = Buffer.allocUnsafeSlow(CHUNK_SIZE);

      const hash = createHash(algorithm);

      let bytesRead = 0;
      while ((bytesRead = await this.readPromise(fd, chunk, 0, CHUNK_SIZE)) !== 0)
        hash.update(bytesRead === CHUNK_SIZE ? chunk : chunk.slice(0, bytesRead));

      return hash.digest(`hex`);
    } finally {
      await this.closePromise(fd);
    }
  }

  async removePromise(p: P, {recursive = true, maxRetries = 5}: {recursive?: boolean, maxRetries?: number} = {}) {
    let stat;
    try {
      stat = await this.lstatPromise(p);
    } catch (error) {
      if (error.code === `ENOENT`) {
        return;
      } else {
        throw error;
      }
    }

    if (stat.isDirectory()) {
      if (recursive) {
        const entries = await this.readdirPromise(p);

        await Promise.all(entries.map(entry => {
          return this.removePromise(this.pathUtils.resolve(p, entry));
        }));
      }

      // 5 gives 1s worth of retries at worst
      for (let t = 0; t <= maxRetries; t++) {
        try {
          await this.rmdirPromise(p);
          break;
        } catch (error) {
          if (error.code !== `EBUSY` && error.code !== `ENOTEMPTY`) {
            throw error;
          } else if (t < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, t * 100));
          }
        }
      }
    } else {
      await this.unlinkPromise(p);
    }
  }

  removeSync(p: P, {recursive = true}: {recursive?: boolean} = {}) {
    let stat;
    try {
      stat = this.lstatSync(p);
    } catch (error) {
      if (error.code === `ENOENT`) {
        return;
      } else {
        throw error;
      }
    }

    if (stat.isDirectory()) {
      if (recursive)
        for (const entry of this.readdirSync(p))
          this.removeSync(this.pathUtils.resolve(p, entry));

      this.rmdirSync(p);
    } else {
      this.unlinkSync(p);
    }
  }

  async mkdirpPromise(p: P, {chmod, utimes}: {chmod?: number, utimes?: [Date | string | number, Date | string | number]} = {}): Promise<string | undefined> {
    p = this.resolve(p);
    if (p === this.pathUtils.dirname(p))
      return undefined;

    const parts = p.split(this.pathUtils.sep);

    let createdDirectory: P | undefined;

    for (let u = 2; u <= parts.length; ++u) {
      const subPath = parts.slice(0, u).join(this.pathUtils.sep) as P;

      if (!this.existsSync(subPath)) {
        try {
          await this.mkdirPromise(subPath);
        } catch (error) {
          if (error.code === `EEXIST`) {
            continue;
          } else {
            throw error;
          }
        }

        createdDirectory ??= subPath;

        if (chmod != null)
          await this.chmodPromise(subPath, chmod);

        if (utimes != null) {
          await this.utimesPromise(subPath, utimes[0], utimes[1]);
        } else {
          const parentStat = await this.statPromise(this.pathUtils.dirname(subPath));
          await this.utimesPromise(subPath, parentStat.atime, parentStat.mtime);
        }
      }
    }

    return createdDirectory;
  }

  mkdirpSync(p: P, {chmod, utimes}: {chmod?: number, utimes?: [Date | string | number, Date | string | number]} = {}): string | undefined {
    p = this.resolve(p);
    if (p === this.pathUtils.dirname(p))
      return undefined;

    const parts = p.split(this.pathUtils.sep);

    let createdDirectory: P | undefined;

    for (let u = 2; u <= parts.length; ++u) {
      const subPath = parts.slice(0, u).join(this.pathUtils.sep) as P;

      if (!this.existsSync(subPath)) {
        try {
          this.mkdirSync(subPath);
        } catch (error) {
          if (error.code === `EEXIST`) {
            continue;
          } else {
            throw error;
          }
        }

        createdDirectory ??= subPath;

        if (chmod != null)
          this.chmodSync(subPath, chmod);

        if (utimes != null) {
          this.utimesSync(subPath, utimes[0], utimes[1]);
        } else {
          const parentStat = this.statSync(this.pathUtils.dirname(subPath));
          this.utimesSync(subPath, parentStat.atime, parentStat.mtime);
        }
      }
    }

    return createdDirectory;
  }

  copyPromise(destination: P, source: P, options?: {baseFs?: undefined, overwrite?: boolean, stableSort?: boolean, stableTime?: boolean, linkStrategy?: LinkStrategy<P> | null}): Promise<void>;
  copyPromise<P2 extends Path>(destination: P, source: P2, options: {baseFs: FakeFS<P2>, overwrite?: boolean, stableSort?: boolean, stableTime?: boolean, linkStrategy?: LinkStrategy<P> | null}): Promise<void>;
  async copyPromise<P2 extends Path>(destination: P, source: P2, {baseFs = this as any, overwrite = true, stableSort = false, stableTime = false, linkStrategy = null}: {baseFs?: FakeFS<P2>, overwrite?: boolean, stableSort?: boolean, stableTime?: boolean, linkStrategy?: LinkStrategy<P> | null} = {}) {
    return await copyPromise(this, destination, baseFs, source, {overwrite, stableSort, stableTime, linkStrategy});
  }

  /** @deprecated Prefer using `copyPromise` instead */
  copySync(destination: P, source: P, options?: {baseFs?: undefined, overwrite?: boolean}): void;
  copySync<P2 extends Path>(destination: P, source: P2, options: {baseFs: FakeFS<P2>, overwrite?: boolean}): void;
  copySync<P2 extends Path>(destination: P, source: P2, {baseFs = this as any, overwrite = true}: {baseFs?: FakeFS<P2>, overwrite?: boolean} = {}) {
    const stat = baseFs.lstatSync(source);
    const exists = this.existsSync(destination);

    if (stat.isDirectory()) {
      this.mkdirpSync(destination);
      const directoryListing = baseFs.readdirSync(source);
      for (const entry of directoryListing) {
        this.copySync(this.pathUtils.join(destination, entry), baseFs.pathUtils.join(source, entry), {baseFs, overwrite});
      }
    } else if (stat.isFile()) {
      if (!exists || overwrite) {
        if (exists)
          this.removeSync(destination);

        const content = baseFs.readFileSync(source);
        this.writeFileSync(destination, content);
      }
    } else if (stat.isSymbolicLink()) {
      if (!exists || overwrite) {
        if (exists)
          this.removeSync(destination);

        const target = baseFs.readlinkSync(source);
        this.symlinkSync(convertPath(this.pathUtils, target), destination);
      }
    } else {
      throw new Error(`Unsupported file type (file: ${source}, mode: 0o${stat.mode.toString(8).padStart(6, `0`)})`);
    }

    const mode = stat.mode & 0o777;
    this.chmodSync(destination, mode);
  }

  async changeFilePromise(p: P, content: Buffer): Promise<void>;
  async changeFilePromise(p: P, content: string, opts?: ChangeFileOptions): Promise<void>;
  async changeFilePromise(p: P, content: Buffer | string, opts: ChangeFileOptions = {}) {
    if (Buffer.isBuffer(content)) {
      return this.changeFileBufferPromise(p, content, opts);
    } else {
      return this.changeFileTextPromise(p, content, opts);
    }
  }

  private async changeFileBufferPromise(p: P, content: Buffer, {mode}: ChangeFileOptions = {}) {
    let current = Buffer.alloc(0);
    try {
      current = await this.readFilePromise(p);
    } catch (error) {
      // ignore errors, no big deal
    }

    if (Buffer.compare(current, content) === 0)
      return;

    await this.writeFilePromise(p, content, {mode});
  }

  private async changeFileTextPromise(p: P, content: string, {automaticNewlines, mode}: ChangeFileOptions = {}) {
    let current = ``;
    try {
      current = await this.readFilePromise(p, `utf8`);
    } catch (error) {
      // ignore errors, no big deal
    }

    const normalizedContent = automaticNewlines
      ? normalizeLineEndings(current, content)
      : content;

    if (current === normalizedContent)
      return;

    await this.writeFilePromise(p, normalizedContent, {mode});
  }

  changeFileSync(p: P, content: Buffer): void;
  changeFileSync(p: P, content: string, opts?: ChangeFileOptions): void;
  changeFileSync(p: P, content: Buffer | string, opts: ChangeFileOptions = {}) {
    if (Buffer.isBuffer(content)) {
      return this.changeFileBufferSync(p, content, opts);
    } else {
      return this.changeFileTextSync(p, content, opts);
    }
  }

  private changeFileBufferSync(p: P, content: Buffer, {mode}: ChangeFileOptions = {}) {
    let current = Buffer.alloc(0);
    try {
      current = this.readFileSync(p);
    } catch (error) {
      // ignore errors, no big deal
    }

    if (Buffer.compare(current, content) === 0)
      return;

    this.writeFileSync(p, content, {mode});
  }

  private changeFileTextSync(p: P, content: string, {automaticNewlines = false, mode}: ChangeFileOptions = {}) {
    let current = ``;
    try {
      current = this.readFileSync(p, `utf8`);
    } catch (error) {
      // ignore errors, no big deal
    }

    const normalizedContent = automaticNewlines
      ? normalizeLineEndings(current, content)
      : content;

    if (current === normalizedContent)
      return;

    this.writeFileSync(p, normalizedContent, {mode});
  }

  async movePromise(fromP: P, toP: P) {
    try {
      await this.renamePromise(fromP, toP);
    } catch (error) {
      if (error.code === `EXDEV`) {
        await this.copyPromise(toP, fromP);
        await this.removePromise(fromP);
      } else {
        throw error;
      }
    }
  }

  moveSync(fromP: P, toP: P) {
    try {
      this.renameSync(fromP, toP);
    } catch (error) {
      if (error.code === `EXDEV`) {
        this.copySync(toP, fromP);
        this.removeSync(fromP);
      } else {
        throw error;
      }
    }
  }

  async lockPromise<T>(affectedPath: P, callback: () => Promise<T>): Promise<T> {
    const lockPath = `${affectedPath}.flock` as P;

    const interval = 1000 / 60;
    const startTime = Date.now();

    let fd = null;

    // Even when we detect that a lock file exists, we still look inside to see
    // whether the pid that created it is still alive. It's not foolproof
    // (there are false positive), but there are no false negative and that's
    // all that matters in 99% of the cases.
    const isAlive = async () => {
      let pid: number;

      try {
        ([pid] = await this.readJsonPromise(lockPath));
      } catch (error) {
        // If we can't read the file repeatedly, we assume the process was
        // aborted before even writing finishing writing the payload.
        return Date.now() - startTime < 500;
      }

      try {
        // "As a special case, a signal of 0 can be used to test for the
        // existence of a process" - so we check whether it's alive.
        process.kill(pid, 0);
        return true;
      } catch (error) {
        return false;
      }
    };

    while (fd === null) {
      try {
        fd = await this.openPromise(lockPath, `wx`);
      } catch (error) {
        if (error.code === `EEXIST`) {
          if (!await isAlive()) {
            try {
              await this.unlinkPromise(lockPath);
              continue;
            } catch (error) {
              // No big deal if we can't remove it. Just fallback to wait for
              // it to be eventually released by its owner.
            }
          }
          if (Date.now() - startTime < 60 * 1000) {
            await new Promise(resolve => setTimeout(resolve, interval));
          } else {
            throw new Error(`Couldn't acquire a lock in a reasonable time (via ${lockPath})`);
          }
        } else {
          throw error;
        }
      }
    }

    await this.writePromise(fd, JSON.stringify([process.pid]));

    try {
      return await callback();
    } finally {
      try {
        // closePromise needs to come before unlinkPromise otherwise another process can attempt
        // to get the file handle after the unlink but before close resuling in
        // EPERM: operation not permitted, open
        await this.closePromise(fd);
        await this.unlinkPromise(lockPath);
      } catch (error) {
        // noop
      }
    }
  }

  async readJsonPromise(p: P) {
    const content = await this.readFilePromise(p, `utf8`);

    try {
      return JSON.parse(content);
    } catch (error) {
      error.message += ` (in ${p})`;
      throw error;
    }
  }

  readJsonSync(p: P) {
    const content = this.readFileSync(p, `utf8`);

    try {
      return JSON.parse(content);
    } catch (error) {
      error.message += ` (in ${p})`;
      throw error;
    }
  }

  async writeJsonPromise(p: P, data: any, {compact = false}: {compact?: boolean} = {}) {
    const space = compact
      ? 0
      : 2;

    return await this.writeFilePromise(p, `${JSON.stringify(data, null, space)}\n`);
  }

  writeJsonSync(p: P, data: any, {compact = false}: {compact?: boolean} = {}) {
    const space = compact
      ? 0
      : 2;

    return this.writeFileSync(p, `${JSON.stringify(data, null, space)}\n`);
  }

  async preserveTimePromise(p: P, cb: () => Promise<P | void>) {
    const stat = await this.lstatPromise(p);

    const result = await cb();
    if (typeof result !== `undefined`)
      p = result;

    await this.lutimesPromise(p, stat.atime, stat.mtime);
  }

  async preserveTimeSync(p: P, cb: () => P | void) {
    const stat = this.lstatSync(p);

    const result = cb();
    if (typeof result !== `undefined`)
      p = result;

    this.lutimesSync(p, stat.atime, stat.mtime);
  }
}

export abstract class BasePortableFakeFS extends FakeFS<PortablePath> {
  protected constructor() {
    super(ppath);
  }
}

function getEndOfLine(content: string) {
  const matches = content.match(/\r?\n/g);
  if (matches === null)
    return EOL;

  const crlf = matches.filter(nl => nl === `\r\n`).length;
  const lf = matches.length - crlf;

  return crlf > lf ? `\r\n` : `\n`;
}

export function normalizeLineEndings(originalContent: string, newContent: string) {
  return newContent.replace(/\r?\n/g, getEndOfLine(originalContent));
}
