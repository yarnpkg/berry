import {WatchOptions, WatchCallback, Watcher, Dir, Stats, BigIntStats, StatSyncOptions, StatOptions}                                                 from '@yarnpkg/fslib';
import {FakeFS, MkdirOptions, RmdirOptions, WriteFileOptions, OpendirOptions}                                                                        from '@yarnpkg/fslib';
import {CreateReadStreamOptions, CreateWriteStreamOptions, BasePortableFakeFS, ExtractHintOptions, WatchFileCallback, WatchFileOptions, StatWatcher} from '@yarnpkg/fslib';
import {NodeFS}                                                                                                                                      from '@yarnpkg/fslib';
import {opendir}                                                                                                                                     from '@yarnpkg/fslib';
import {watchFile, unwatchFile, unwatchAllFiles}                                                                                                     from '@yarnpkg/fslib';
import {errors, statUtils}                                                                                                                           from '@yarnpkg/fslib';
import {FSPath, PortablePath, ppath, Filename}                                                                                                       from '@yarnpkg/fslib';
import {ReadStream, WriteStream, constants}                                                                                                          from 'fs';
import {PassThrough}                                                                                                                                 from 'stream';
// @ts-expect-error
import {ZipArchive, constants as zlibConstants}                                                                                                      from 'zlib';

import {
  DEFAULT_COMPRESSION_LEVEL,
  ZipBufferOptions,
  ZipCompression,
  ZipPathOptions,
  makeEmptyArchive,
  toUnixTimestamp,
} from './common';

const {
  // @ts-expect-error
  ZIP_OPSYS_UNIX,
} = zlibConstants;

export class NativeZipFS extends BasePortableFakeFS {
  private readonly baseFs: FakeFS<PortablePath> | null;
  private readonly path: PortablePath | null;

  private readonly stats: Stats;
  private readonly zip: ZipArchive;
  private readonly level: ZipCompression;

  private readonly listings: Map<PortablePath, Set<Filename>> = new Map();
  private readonly entries: Map<PortablePath, number> = new Map();

  /**
   * A cache of indices mapped to file sources.
   * Populated by `setFileSource` calls.
   * Required for supporting read after write.
   */
  private readonly fileSources: Map<number, Buffer> = new Map();

  private symlinkCount: number;

  private readonly fds: Map<number, {cursor: number, p: PortablePath}> = new Map();
  private nextFd: number = 0;

  private ready = false;
  private readOnly = false;

  constructor();
  constructor(p: PortablePath, opts?: ZipPathOptions);
  /**
   * Create a ZipFS in memory
   * @param data If null; an empty zip file will be created
   */
  constructor(data: Buffer | null, opts?: ZipBufferOptions);

  constructor(source?: PortablePath | Buffer | null, opts: ZipPathOptions | ZipBufferOptions = {}) {
    super();

    const pathOptions = opts as ZipPathOptions;
    this.level = typeof pathOptions.level !== `undefined`
      ? pathOptions.level
      : DEFAULT_COMPRESSION_LEVEL;

    source ??= makeEmptyArchive();

    if (typeof source === `string`) {
      const {baseFs = new NodeFS()} = pathOptions;
      this.baseFs = baseFs;
      this.path = source;
    } else {
      this.path = null;
      this.baseFs = null;
    }

    if (opts.stats) {
      this.stats = opts.stats;
    } else {
      if (typeof source === `string`) {
        try {
          this.stats = this.baseFs!.statSync(source);
        } catch (error) {
          if (error.code === `ENOENT` && pathOptions.create) {
            this.stats = statUtils.makeDefaultStats();
          } else {
            throw error;
          }
        }
      } else {
        this.stats = statUtils.makeDefaultStats();
      }
    }

    if (opts.readOnly)
      this.readOnly = true;

    const getFileContent = (p: PortablePath, opts: ZipPathOptions) => {
      try {
        return this.baseFs!.readFileSync(p);
      } catch (err) {
        if (err.code === `ENOENT` && opts.create) {
          return null;
        } else {
          throw err;
        }
      }
    };

    this.zip = typeof source === `string`
      ? new ZipArchive(getFileContent(source, opts))
      : new ZipArchive(source);

    this.listings.set(PortablePath.root, new Set<Filename>());

    this.symlinkCount = 0;

    const entries = this.zip.getEntries({withFileTypes: true});
    for (const [raw, entry] of entries) {
      if (ppath.isAbsolute(raw))
        continue;

      if (entry.isSymbolicLink())
        this.symlinkCount += 1;

      const p = ppath.resolve(PortablePath.root, raw);
      this.registerEntry(p, entry.entry);

      // If the raw path is a directory, register it
      // to prevent empty folder being skipped
      if (raw.endsWith(`/`)) {
        this.registerListing(p);
      }
    }

    this.ready = true;
  }

  getExtractHint(hints: ExtractHintOptions) {
    for (const fileName of this.entries.keys()) {
      const ext = this.pathUtils.extname(fileName);
      if (hints.relevantExtensions.has(ext)) {
        return true;
      }
    }

    return false;
  }

  getAllFiles() {
    return Array.from(this.entries.keys());
  }

  getRealPath() {
    if (!this.path)
      throw new Error(`ZipFS don't have real paths when loaded from a buffer`);

    return this.path;
  }

  private prepareClose() {
    if (!this.ready)
      throw errors.EBUSY(`archive closed, close`);

    unwatchAllFiles(this);
    this.ready = false;
  }

  saveAndClose() {
    if (!this.path || !this.baseFs)
      throw new Error(`ZipFS cannot be saved and must be discarded when loaded from a buffer`);

    if (this.readOnly)
      return;

    this.prepareClose();

    const newMode = this.baseFs.existsSync(this.path) || this.stats.mode === statUtils.DEFAULT_MODE
      ? undefined
      : this.stats.mode;

    const buf = this.zip.digest();
    this.baseFs.writeFileSync(this.path, buf, {mode: newMode});
  }

  getBufferAndClose(): Buffer {
    this.prepareClose();

    return this.zip.digest();
  }

  discardAndClose() {
    this.prepareClose();
  }

  resolve(p: PortablePath) {
    return ppath.resolve(PortablePath.root, p);
  }

  async openPromise(p: PortablePath, flags: string, mode?: number) {
    return this.openSync(p, flags, mode);
  }

  openSync(p: PortablePath, flags: string, mode?: number) {
    const fd = this.nextFd++;
    this.fds.set(fd, {cursor: 0, p});
    return fd;
  }

  hasOpenFileHandles(): boolean {
    return !!this.fds.size;
  }

  async opendirPromise(p: PortablePath, opts?: OpendirOptions) {
    return this.opendirSync(p, opts);
  }

  opendirSync(p: PortablePath, opts: OpendirOptions = {}): Dir<PortablePath> {
    const resolvedP = this.resolveFilename(`opendir '${p}'`, p);
    if (!this.entries.has(resolvedP) && !this.listings.has(resolvedP))
      throw errors.ENOENT(`opendir '${p}'`);

    const directoryListing = this.listings.get(resolvedP);
    if (!directoryListing)
      throw errors.ENOTDIR(`opendir '${p}'`);

    const entries = [...directoryListing];

    const fd = this.openSync(resolvedP, `r`);

    const onClose = () => {
      this.closeSync(fd);
    };

    return opendir(this, resolvedP, entries, {onClose});
  }

  async readPromise(fd: number, buffer: Buffer, offset?: number, length?: number, position?: number | null) {
    return this.readSync(fd, buffer, offset, length, position);
  }

  readSync(fd: number, buffer: Buffer, offset: number = 0, length: number = buffer.byteLength, position: number | null = -1) {
    const entry = this.fds.get(fd);
    if (typeof entry === `undefined`)
      throw errors.EBADF(`read`);

    const realPosition = position === -1 || position === null
      ? entry.cursor
      : position;

    const source = this.readFileSync(entry.p);
    source.copy(buffer, offset, realPosition, realPosition + length);

    const bytesRead = Math.max(0, Math.min(source.length - realPosition, length));
    if (position === -1 || position === null)
      entry.cursor += bytesRead;

    return bytesRead;
  }

  writePromise(fd: number, buffer: Buffer, offset?: number, length?: number, position?: number): Promise<number>;
  writePromise(fd: number, buffer: string, position?: number): Promise<number>;
  async writePromise(fd: number, buffer: Buffer | string, offset?: number, length?: number, position?: number): Promise<number> {
    if (typeof buffer === `string`) {
      return this.writeSync(fd, buffer, position);
    } else {
      return this.writeSync(fd, buffer, offset, length, position);
    }
  }

  writeSync(fd: number, buffer: Buffer, offset?: number, length?: number, position?: number): number;
  writeSync(fd: number, buffer: string, position?: number): number;
  writeSync(fd: number, buffer: Buffer | string, offset?: number, length?: number, position?: number): never {
    const entry = this.fds.get(fd);
    if (typeof entry === `undefined`)
      throw errors.EBADF(`read`);

    throw new Error(`Unimplemented`);
  }

  async closePromise(fd: number) {
    return this.closeSync(fd);
  }

  closeSync(fd: number) {
    const entry = this.fds.get(fd);
    if (typeof entry === `undefined`)
      throw errors.EBADF(`read`);

    this.fds.delete(fd);
  }

  createReadStream(p: PortablePath | null, {encoding}: CreateReadStreamOptions = {}): ReadStream {
    if (p === null)
      throw new Error(`Unimplemented`);

    const fd = this.openSync(p, `r`);

    const stream = Object.assign(
      new PassThrough({
        emitClose: true,
        autoDestroy: true,
        destroy: (error, callback) => {
          clearImmediate(immediate);
          this.closeSync(fd);
          callback(error);
        },
      }),
      {
        close() {
          stream.destroy();
        },
        bytesRead: 0,
        path: p,
        // "This property is `true` if the underlying file has not been opened yet"
        pending: false,
      },
    );

    const immediate = setImmediate(async () => {
      try {
        const data = await this.readFilePromise(p, encoding);
        stream.bytesRead = data.length;
        stream.end(data);
      } catch (error) {
        stream.destroy(error);
      }
    });

    return stream;
  }

  createWriteStream(p: PortablePath | null, {encoding}: CreateWriteStreamOptions = {}): WriteStream {
    if (this.readOnly)
      throw errors.EROFS(`open '${p}'`);

    if (p === null)
      throw new Error(`Unimplemented`);

    const chunks: Array<Buffer> = [];

    const fd = this.openSync(p, `w`);

    const stream = Object.assign(
      new PassThrough({
        autoDestroy: true,
        emitClose: true,
        destroy: (error, callback) => {
          try {
            if (error) {
              callback(error);
            } else {
              this.writeFileSync(p, Buffer.concat(chunks), encoding);
              callback(null);
            }
          } catch (err) {
            callback(err);
          } finally {
            this.closeSync(fd);
          }
        },
      }),
      {
        close() {
          stream.destroy();
        },
        bytesWritten: 0,
        path: p,
        // "This property is `true` if the underlying file has not been opened yet"
        pending: false,
      },
    );

    stream.on(`data`, chunk => {
      const chunkBuffer = Buffer.from(chunk);
      stream.bytesWritten += chunkBuffer.length;
      chunks.push(chunkBuffer);
    });

    return stream;
  }

  async realpathPromise(p: PortablePath) {
    return this.realpathSync(p);
  }

  realpathSync(p: PortablePath): PortablePath {
    const resolvedP = this.resolveFilename(`lstat '${p}'`, p);

    if (!this.entries.has(resolvedP) && !this.listings.has(resolvedP))
      throw errors.ENOENT(`lstat '${p}'`);

    return resolvedP;
  }

  async existsPromise(p: PortablePath) {
    return this.existsSync(p);
  }

  existsSync(p: PortablePath): boolean {
    if (!this.ready)
      throw errors.EBUSY(`archive closed, existsSync '${p}'`);

    if (this.symlinkCount === 0) {
      const resolvedP = ppath.resolve(PortablePath.root, p);
      return this.entries.has(resolvedP) || this.listings.has(resolvedP);
    }

    let resolvedP;

    try {
      resolvedP = this.resolveFilename(`stat '${p}'`, p, undefined, false);
    } catch (error) {
      return false;
    }

    if (resolvedP === undefined)
      return false;

    return this.entries.has(resolvedP) || this.listings.has(resolvedP);
  }

  async accessPromise(p: PortablePath, mode?: number) {
    return this.accessSync(p, mode);
  }

  accessSync(p: PortablePath, mode: number = constants.F_OK) {
    const resolvedP = this.resolveFilename(`access '${p}'`, p);

    if (!this.entries.has(resolvedP) && !this.listings.has(resolvedP))
      throw errors.ENOENT(`access '${p}'`);

    if (this.readOnly && (mode & constants.W_OK)) {
      throw errors.EROFS(`access '${p}'`);
    }
  }

  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/51d793492d4c2e372b01257668dcd3afc58d7352/types/node/v16/fs.d.ts#L1042-L1059
  async statPromise(p: PortablePath): Promise<Stats>;
  async statPromise(p: PortablePath, opts: (StatOptions & { bigint?: false | undefined }) | undefined): Promise<Stats>;
  async statPromise(p: PortablePath, opts: StatOptions & { bigint: true }): Promise<BigIntStats>;
  async statPromise(p: PortablePath, opts?: StatOptions): Promise<Stats | BigIntStats>;
  async statPromise(p: PortablePath, opts: StatOptions = {bigint: false}): Promise<Stats | BigIntStats> {
    if (opts.bigint)
      return this.statSync(p, {bigint: true});

    return this.statSync(p);
  }

  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/51d793492d4c2e372b01257668dcd3afc58d7352/types/node/v16/fs.d.ts#L931-L967
  statSync(p: PortablePath): Stats;
  statSync(p: PortablePath, opts?: StatSyncOptions & {bigint?: false | undefined, throwIfNoEntry: false}): Stats | undefined;
  statSync(p: PortablePath, opts: StatSyncOptions & {bigint: true, throwIfNoEntry: false}): BigIntStats | undefined;
  statSync(p: PortablePath, opts?: StatSyncOptions & {bigint?: false | undefined}): Stats;
  statSync(p: PortablePath, opts: StatSyncOptions & {bigint: true}): BigIntStats;
  statSync(p: PortablePath, opts: StatSyncOptions & {bigint: boolean, throwIfNoEntry?: false | undefined}): Stats | BigIntStats;
  statSync(p: PortablePath, opts?: StatSyncOptions): Stats | BigIntStats | undefined;
  statSync(p: PortablePath, opts: StatSyncOptions = {bigint: false, throwIfNoEntry: true}): Stats | BigIntStats | undefined {
    const resolvedP = this.resolveFilename(`stat '${p}'`, p, undefined, opts.throwIfNoEntry);
    if (resolvedP === undefined)
      return undefined;

    if (!this.entries.has(resolvedP) && !this.listings.has(resolvedP)) {
      if (opts.throwIfNoEntry === false)
        return undefined;

      throw errors.ENOENT(`stat '${p}'`);
    }

    if (p[p.length - 1] === `/` && !this.listings.has(resolvedP))
      throw errors.ENOTDIR(`stat '${p}'`);

    return this.statImpl(`stat '${p}'`, resolvedP, opts);
  }

  async fstatPromise(fd: number): Promise<Stats>
  async fstatPromise(fd: number, opts: {bigint: true}): Promise<BigIntStats>
  async fstatPromise(fd: number, opts?: {bigint: boolean}): Promise<BigIntStats | Stats>
  async fstatPromise(fd: number, opts?: {bigint: boolean}) {
    return this.fstatSync(fd, opts);
  }

  fstatSync(fd: number): Stats
  fstatSync(fd: number, opts: {bigint: true}): BigIntStats
  fstatSync(fd: number, opts?: {bigint: boolean}): BigIntStats | Stats
  fstatSync(fd: number, opts?: {bigint: boolean}) {
    const entry = this.fds.get(fd);
    if (typeof entry === `undefined`)
      throw errors.EBADF(`fstatSync`);

    const {p} = entry;

    const resolvedP = this.resolveFilename(`stat '${p}'`, p);

    if (!this.entries.has(resolvedP) && !this.listings.has(resolvedP))
      throw errors.ENOENT(`stat '${p}'`);

    if (p[p.length - 1] === `/` && !this.listings.has(resolvedP))
      throw errors.ENOTDIR(`stat '${p}'`);

    return this.statImpl(`fstat '${p}'`, resolvedP, opts);
  }

  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/51d793492d4c2e372b01257668dcd3afc58d7352/types/node/v16/fs.d.ts#L1042-L1059
  async lstatPromise(p: PortablePath): Promise<Stats>;
  async lstatPromise(p: PortablePath, opts: (StatOptions & { bigint?: false | undefined }) | undefined): Promise<Stats>;
  async lstatPromise(p: PortablePath, opts: StatOptions & { bigint: true }): Promise<BigIntStats>;
  async lstatPromise(p: PortablePath, opts?: StatOptions): Promise<Stats | BigIntStats>;
  async lstatPromise(p: PortablePath, opts: StatOptions = {bigint: false}): Promise<Stats | BigIntStats> {
    if (opts.bigint)
      return this.lstatSync(p, {bigint: true});

    return this.lstatSync(p);
  }

  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/51d793492d4c2e372b01257668dcd3afc58d7352/types/node/v16/fs.d.ts#L931-L967
  lstatSync(p: PortablePath): Stats;
  lstatSync(p: PortablePath, opts?: StatSyncOptions & {bigint?: false | undefined, throwIfNoEntry: false}): Stats | undefined;
  lstatSync(p: PortablePath, opts: StatSyncOptions & {bigint: true, throwIfNoEntry: false}): BigIntStats | undefined;
  lstatSync(p: PortablePath, opts?: StatSyncOptions & {bigint?: false | undefined}): Stats;
  lstatSync(p: PortablePath, opts: StatSyncOptions & {bigint: true}): BigIntStats;
  lstatSync(p: PortablePath, opts: StatSyncOptions & { bigint: boolean, throwIfNoEntry?: false | undefined }): Stats | BigIntStats;
  lstatSync(p: PortablePath, opts?: StatSyncOptions): Stats | BigIntStats | undefined;
  lstatSync(p: PortablePath, opts: StatSyncOptions = {bigint: false, throwIfNoEntry: true}): Stats | BigIntStats | undefined {
    const resolvedP = this.resolveFilename(`lstat '${p}'`, p, false, opts.throwIfNoEntry);
    if (resolvedP === undefined)
      return undefined;

    if (!this.entries.has(resolvedP) && !this.listings.has(resolvedP)) {
      if (opts.throwIfNoEntry === false)
        return undefined;

      throw errors.ENOENT(`lstat '${p}'`);
    }

    if (p[p.length - 1] === `/` && !this.listings.has(resolvedP))
      throw errors.ENOTDIR(`lstat '${p}'`);

    return this.statImpl(`lstat '${p}'`, resolvedP, opts);
  }

  private statImpl(reason: string, p: PortablePath, opts: {bigint: true}): BigIntStats;
  private statImpl(reason: string, p: PortablePath, opts?: {bigint?: false}): Stats;
  private statImpl(reason: string, p: PortablePath, opts?: {bigint?: boolean}): Stats | BigIntStats;
  private statImpl(reason: string, p: PortablePath, opts: {bigint?: boolean} = {}): Stats | BigIntStats {
    const entry = this.entries.get(p);

    // File, or explicit directory
    if (typeof entry !== `undefined`) {
      const stat = this.zip.statEntry(entry);

      const uid = this.stats.uid;
      const gid = this.stats.gid;

      const size = stat.size;
      const blksize = 512;
      const blocks = Math.ceil(size / blksize);

      const mtimeMs = stat.mtimeMs;
      const atimeMs = mtimeMs;
      const birthtimeMs = mtimeMs;
      const ctimeMs = mtimeMs;

      const atime = new Date(atimeMs);
      const birthtime = new Date(birthtimeMs);
      const ctime = new Date(ctimeMs);
      const mtime = new Date(mtimeMs);

      const type = this.listings.has(p)
        ? constants.S_IFDIR
        : this.isSymbolicLink(entry)
          ? constants.S_IFLNK
          : constants.S_IFREG;

      const defaultMode = type === constants.S_IFDIR
        ? 0o755
        : 0o644;

      const mode = type | (this.getUnixMode(entry, defaultMode) & 0o777);
      const crc = stat.crc;

      const statInstance = Object.assign(new statUtils.StatEntry(), {uid, gid, size, blksize, blocks, atime, birthtime, ctime, mtime, atimeMs, birthtimeMs, ctimeMs, mtimeMs, mode, crc});
      return opts.bigint === true ? statUtils.convertToBigIntStats(statInstance) : statInstance;
    }

    // Implicit directory
    if (this.listings.has(p)) {
      const uid = this.stats.uid;
      const gid = this.stats.gid;

      const size = 0;
      const blksize = 512;
      const blocks = 0;

      const atimeMs = this.stats.mtimeMs;
      const birthtimeMs = this.stats.mtimeMs;
      const ctimeMs = this.stats.mtimeMs;
      const mtimeMs = this.stats.mtimeMs;

      const atime = new Date(atimeMs);
      const birthtime = new Date(birthtimeMs);
      const ctime = new Date(ctimeMs);
      const mtime = new Date(mtimeMs);

      const mode = constants.S_IFDIR | 0o755;
      const crc = 0;

      const statInstance = Object.assign(new statUtils.StatEntry(), {uid, gid, size, blksize, blocks, atime, birthtime, ctime, mtime, atimeMs, birthtimeMs, ctimeMs, mtimeMs, mode, crc});
      return opts.bigint === true ? statUtils.convertToBigIntStats(statInstance) : statInstance;
    }

    throw new Error(`Unreachable`);
  }

  private getUnixMode(index: number, defaultMode: number) {
    const {opsys, attributes} = this.zip.statEntry(index);
    if (opsys !== ZIP_OPSYS_UNIX)
      return defaultMode;

    return attributes >>> 16;
  }

  private registerListing(p: PortablePath) {
    const existingListing = this.listings.get(p);
    if (existingListing)
      return existingListing;

    const parentListing = this.registerListing(ppath.dirname(p));
    parentListing.add(ppath.basename(p));

    const newListing = new Set<Filename>();
    this.listings.set(p, newListing);

    return newListing;
  }

  private registerEntry(p: PortablePath, index: number) {
    const parentListing = this.registerListing(ppath.dirname(p));
    parentListing.add(ppath.basename(p));

    this.entries.set(p, index);
  }

  private unregisterListing(p: PortablePath) {
    this.listings.delete(p);

    const parentListing = this.listings.get(ppath.dirname(p));
    parentListing?.delete(ppath.basename(p));
  }

  private unregisterEntry(p: PortablePath) {
    this.unregisterListing(p);

    const entry = this.entries.get(p);
    this.entries.delete(p);

    if (typeof entry === `undefined`)
      return;

    this.fileSources.delete(entry);

    if (this.isSymbolicLink(entry)) {
      this.symlinkCount--;
    }
  }

  private deleteEntry(p: PortablePath, index: number) {
    this.unregisterEntry(p);

    this.zip.deleteEntry(index);
  }

  private resolveFilename(reason: string, p: PortablePath, resolveLastComponent?: boolean): PortablePath;
  private resolveFilename(reason: string, p: PortablePath, resolveLastComponent: boolean | undefined, throwIfNoEntry: boolean | undefined): PortablePath | undefined;
  private resolveFilename(reason: string, p: PortablePath, resolveLastComponent: boolean = true, throwIfNoEntry = true): PortablePath | undefined {
    if (!this.ready)
      throw errors.EBUSY(`archive closed, ${reason}`);

    let resolvedP = ppath.resolve(PortablePath.root, p);
    if (resolvedP === `/`)
      return PortablePath.root;

    const fileIndex = this.entries.get(resolvedP);
    if (resolveLastComponent && fileIndex !== undefined) {
      if (this.symlinkCount !== 0 && this.isSymbolicLink(fileIndex)) {
        const target = this.getFileSource(fileIndex).toString() as PortablePath;
        return this.resolveFilename(reason, ppath.resolve(ppath.dirname(resolvedP), target), true, throwIfNoEntry);
      } else {
        return resolvedP;
      }
    }

    while (true) {
      const parentP = this.resolveFilename(reason, ppath.dirname(resolvedP), true, throwIfNoEntry);
      if (parentP === undefined)
        return parentP;

      const isDir = this.listings.has(parentP);
      const doesExist = this.entries.has(parentP);

      if (!isDir && !doesExist) {
        if (throwIfNoEntry === false)
          return undefined;

        throw errors.ENOENT(reason);
      }

      if (!isDir)
        throw errors.ENOTDIR(reason);

      resolvedP = ppath.resolve(parentP, ppath.basename(resolvedP));
      if (!resolveLastComponent || this.symlinkCount === 0)
        break;

      const index = this.entries.get(resolvedP);
      if (typeof index === `undefined`)
        break;

      if (this.isSymbolicLink(index)) {
        const target = this.getFileSource(index).toString() as PortablePath;
        resolvedP = ppath.resolve(ppath.dirname(resolvedP), target);
      } else {
        break;
      }
    }

    return resolvedP;
  }

  private setFileSource(p: PortablePath, content: string | Buffer | ArrayBuffer | DataView) {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content as any);
    const target = ppath.relative(PortablePath.root, p);

    const newIndex = this.zip.addFile(target, buffer);
    this.fileSources.set(newIndex, buffer);

    return newIndex;
  }

  private isSymbolicLink(index: number) {
    if (this.symlinkCount === 0)
      return false;

    return (this.getUnixMode(index, 0) & constants.S_IFMT) === constants.S_IFLNK;
  }

  private getFileSource(index: number): Buffer
  private getFileSource(index: number, opts: {asyncDecompress: false}): Buffer
  private getFileSource(index: number, opts: {asyncDecompress: true}): Promise<Buffer>
  private getFileSource(index: number, opts: {asyncDecompress: boolean}): Promise<Buffer> | Buffer
  private getFileSource(index: number, opts: {asyncDecompress: boolean} = {asyncDecompress: false}): Promise<Buffer> | Buffer {
    const cachedFileSource = this.fileSources.get(index);
    if (typeof cachedFileSource !== `undefined`)
      return cachedFileSource;

    if (opts.asyncDecompress) {
      return this.zip.readEntryPromise(index).then((data: any) => {
        this.fileSources.set(index, data);
        return data;
      });
    } else {
      const data = this.zip.readEntry(index);
      this.fileSources.set(index, data);
      return data;
    }
  }

  async fchmodPromise(fd: number, mask: number): Promise<void> {
    return this.chmodPromise(this.fdToPath(fd, `fchmod`), mask);
  }

  fchmodSync(fd: number, mask: number): void {
    return this.chmodSync(this.fdToPath(fd, `fchmodSync`), mask);
  }

  async chmodPromise(p: PortablePath, mask: number) {
    return this.chmodSync(p, mask);
  }

  chmodSync(p: PortablePath, mask: number) {
    if (this.readOnly)
      throw errors.EROFS(`chmod '${p}'`);

    // We don't allow to make the extracted entries group-writable
    mask &= 0o755;

    const resolvedP = this.resolveFilename(`chmod '${p}'`, p, false);

    const entry = this.entries.get(resolvedP);
    if (typeof entry === `undefined`)
      throw new Error(`Assertion failed: The entry should have been registered (${resolvedP})`);

    const oldMod = this.getUnixMode(entry, constants.S_IFREG | 0o000);
    const newMod = oldMod & (~0o777) | mask;

    this.zip.restatEntry(entry, {
      opsys: ZIP_OPSYS_UNIX,
      attributes: newMod << 16,
    });
  }

  async fchownPromise(fd: number, uid: number, gid: number): Promise<void> {
    return this.chownPromise(this.fdToPath(fd, `fchown`), uid, gid);
  }

  fchownSync(fd: number, uid: number, gid: number): void {
    return this.chownSync(this.fdToPath(fd, `fchownSync`), uid, gid);
  }

  async chownPromise(p: PortablePath, uid: number, gid: number) {
    return this.chownSync(p, uid, gid);
  }

  chownSync(p: PortablePath, uid: number, gid: number) {
    throw new Error(`Unimplemented`);
  }

  async renamePromise(oldP: PortablePath, newP: PortablePath) {
    return this.renameSync(oldP, newP);
  }

  renameSync(oldP: PortablePath, newP: PortablePath): never {
    throw new Error(`Unimplemented`);
  }

  async copyFilePromise(sourceP: PortablePath, destP: PortablePath, flags?: number) {
    const {indexSource, indexDest, resolvedDestP} = this.prepareCopyFile(sourceP, destP, flags);

    const source = await this.getFileSource(indexSource, {asyncDecompress: true});
    const newIndex = this.setFileSource(resolvedDestP, source);

    if (newIndex !== indexDest) {
      this.registerEntry(resolvedDestP, newIndex);
    }
  }

  copyFileSync(sourceP: PortablePath, destP: PortablePath, flags: number = 0) {
    const {indexSource, indexDest, resolvedDestP} = this.prepareCopyFile(sourceP, destP, flags);

    const source = this.getFileSource(indexSource);
    const newIndex = this.setFileSource(resolvedDestP, source);

    if (newIndex !== indexDest) {
      this.registerEntry(resolvedDestP, newIndex);
    }
  }

  private prepareCopyFile(sourceP: PortablePath, destP: PortablePath, flags: number = 0) {
    if (this.readOnly)
      throw errors.EROFS(`copyfile '${sourceP} -> '${destP}'`);

    if ((flags & constants.COPYFILE_FICLONE_FORCE) !== 0)
      throw errors.ENOSYS(`unsupported clone operation`, `copyfile '${sourceP}' -> ${destP}'`);

    const resolvedSourceP = this.resolveFilename(`copyfile '${sourceP} -> ${destP}'`, sourceP);

    const indexSource = this.entries.get(resolvedSourceP);
    if (typeof indexSource === `undefined`)
      throw errors.EINVAL(`copyfile '${sourceP}' -> '${destP}'`);

    const resolvedDestP = this.resolveFilename(`copyfile '${sourceP}' -> ${destP}'`, destP);
    const indexDest = this.entries.get(resolvedDestP);

    if ((flags & (constants.COPYFILE_EXCL | constants.COPYFILE_FICLONE_FORCE)) !== 0 && typeof indexDest !== `undefined`)
      throw errors.EEXIST(`copyfile '${sourceP}' -> '${destP}'`);

    return {
      indexSource,
      resolvedDestP,
      indexDest,
    };
  }

  async appendFilePromise(p: FSPath<PortablePath>, content: string | Uint8Array, opts?: WriteFileOptions) {
    if (this.readOnly)
      throw errors.EROFS(`open '${p}'`);

    if (typeof opts === `undefined`)
      opts = {flag: `a`};
    else if (typeof opts === `string`)
      opts = {flag: `a`, encoding: opts};
    else if (typeof opts.flag === `undefined`)
      opts = {flag: `a`, ...opts};

    return this.writeFilePromise(p, content, opts);
  }

  appendFileSync(p: FSPath<PortablePath>, content: string | Uint8Array, opts: WriteFileOptions = {}) {
    if (this.readOnly)
      throw errors.EROFS(`open '${p}'`);

    if (typeof opts === `undefined`)
      opts = {flag: `a`};
    else if (typeof opts === `string`)
      opts = {flag: `a`, encoding: opts};
    else if (typeof opts.flag === `undefined`)
      opts = {flag: `a`, ...opts};

    return this.writeFileSync(p, content, opts);
  }

  private fdToPath(fd: number, reason: string) {
    const path = this.fds.get(fd)?.p;
    if (typeof path === `undefined`)
      throw errors.EBADF(reason);

    return path;
  }

  async writeFilePromise(p: FSPath<PortablePath>, content: string | NodeJS.ArrayBufferView, opts?: WriteFileOptions) {
    const {encoding, mode, index, resolvedP} = this.prepareWriteFile(p, opts);

    if (index !== undefined && typeof opts === `object` && opts.flag && opts.flag.includes(`a`))
      content = Buffer.concat([await this.getFileSource(index, {asyncDecompress: true}), Buffer.from(content as any)]);

    if (encoding !== null)
      // @ts-expect-error: toString ignores unneeded arguments
      content = content.toString(encoding);

    const newIndex = this.setFileSource(resolvedP, content);
    if (newIndex !== index)
      this.registerEntry(resolvedP, newIndex);

    if (mode !== null) {
      await this.chmodPromise(resolvedP, mode);
    }
  }

  writeFileSync(p: FSPath<PortablePath>, content: string | NodeJS.ArrayBufferView, opts?: WriteFileOptions) {
    const {encoding, mode, index, resolvedP} = this.prepareWriteFile(p, opts);

    if (index !== undefined && typeof opts === `object` && opts.flag && opts.flag.includes(`a`))
      content = Buffer.concat([this.getFileSource(index), Buffer.from(content as any)]);

    if (encoding !== null)
      // @ts-expect-error: toString ignores unneeded arguments
      content = content.toString(encoding);

    const newIndex = this.setFileSource(resolvedP, content);
    if (newIndex !== index)
      this.registerEntry(resolvedP, newIndex);

    if (mode !== null) {
      this.chmodSync(resolvedP, mode);
    }
  }

  private prepareWriteFile(p: FSPath<PortablePath>, opts?: WriteFileOptions) {
    if (typeof p === `number`)
      p = this.fdToPath(p, `read`);

    if (this.readOnly)
      throw errors.EROFS(`open '${p}'`);

    const resolvedP = this.resolveFilename(`open '${p}'`, p);
    if (this.listings.has(resolvedP))
      throw errors.EISDIR(`open '${p}'`);

    let encoding = null, mode = null;

    if (typeof opts === `string`) {
      encoding = opts;
    } else if (typeof opts === `object`) {
      ({
        encoding = null,
        mode = null,
      } = opts);
    }

    const index = this.entries.get(resolvedP);

    return {
      encoding,
      mode,
      resolvedP,
      index,
    };
  }

  async unlinkPromise(p: PortablePath) {
    return this.unlinkSync(p);
  }

  unlinkSync(p: PortablePath) {
    if (this.readOnly)
      throw errors.EROFS(`unlink '${p}'`);

    const resolvedP = this.resolveFilename(`unlink '${p}'`, p);
    if (this.listings.has(resolvedP))
      throw errors.EISDIR(`unlink '${p}'`);

    const index = this.entries.get(resolvedP);
    if (typeof index === `undefined`)
      throw errors.EINVAL(`unlink '${p}'`);

    this.deleteEntry(resolvedP, index);
  }

  async utimesPromise(p: PortablePath, atime: Date | string | number, mtime: Date | string | number) {
    return this.utimesSync(p, atime, mtime);
  }

  utimesSync(p: PortablePath, atime: Date | string | number, mtime: Date | string | number) {
    if (this.readOnly)
      throw errors.EROFS(`utimes '${p}'`);

    const resolvedP = this.resolveFilename(`utimes '${p}'`, p);

    this.utimesImpl(resolvedP, mtime);
  }

  async lutimesPromise(p: PortablePath, atime: Date | string | number, mtime: Date | string | number) {
    return this.lutimesSync(p, atime, mtime);
  }

  lutimesSync(p: PortablePath, atime: Date | string | number, mtime: Date | string | number) {
    if (this.readOnly)
      throw errors.EROFS(`lutimes '${p}'`);

    const resolvedP = this.resolveFilename(`utimes '${p}'`, p, false);

    this.utimesImpl(resolvedP, mtime);
  }

  private utimesImpl(resolvedP: PortablePath, mtime: Date | string | number) {
    if (this.listings.has(resolvedP))
      if (!this.entries.has(resolvedP))
        this.hydrateDirectory(resolvedP);

    const entry = this.entries.get(resolvedP);
    if (entry === undefined)
      throw new Error(`Unreachable`);

    this.zip.restatEntry(entry, {
      mtime: toUnixTimestamp(mtime),
    });
  }

  async mkdirPromise(p: PortablePath, opts?: MkdirOptions) {
    return this.mkdirSync(p, opts);
  }

  mkdirSync(p: PortablePath, {mode = 0o755, recursive = false}: MkdirOptions = {}) {
    if (recursive)
      return this.mkdirpSync(p, {chmod: mode});

    if (this.readOnly)
      throw errors.EROFS(`mkdir '${p}'`);

    const resolvedP = this.resolveFilename(`mkdir '${p}'`, p);

    if (this.entries.has(resolvedP) || this.listings.has(resolvedP))
      throw errors.EEXIST(`mkdir '${p}'`);

    this.hydrateDirectory(resolvedP);
    this.chmodSync(resolvedP, mode);
    return undefined;
  }

  async rmdirPromise(p: PortablePath, opts?: RmdirOptions) {
    return this.rmdirSync(p, opts);
  }

  rmdirSync(p: PortablePath, {recursive = false}: RmdirOptions = {}) {
    if (this.readOnly)
      throw errors.EROFS(`rmdir '${p}'`);

    if (recursive) {
      this.removeSync(p);
      return;
    }

    const resolvedP = this.resolveFilename(`rmdir '${p}'`, p);

    const directoryListing = this.listings.get(resolvedP);
    if (!directoryListing)
      throw errors.ENOTDIR(`rmdir '${p}'`);

    if (directoryListing.size > 0)
      throw errors.ENOTEMPTY(`rmdir '${p}'`);

    const index = this.entries.get(resolvedP);
    if (typeof index === `undefined`)
      throw errors.EINVAL(`rmdir '${p}'`);

    this.deleteEntry(p, index);
  }

  private hydrateDirectory(resolvedP: PortablePath) {
    const index = this.zip.addDirectory(ppath.relative(PortablePath.root, resolvedP));

    this.registerListing(resolvedP);
    this.registerEntry(resolvedP, index);

    return index;
  }

  async linkPromise(existingP: PortablePath, newP: PortablePath) {
    return this.linkSync(existingP, newP);
  }

  linkSync(existingP: PortablePath, newP: PortablePath) {
    // Zip archives don't support hard links:
    // https://stackoverflow.com/questions/8859616/are-hard-links-possible-within-a-zip-archive
    throw errors.EOPNOTSUPP(`link '${existingP}' -> '${newP}'`);
  }

  async symlinkPromise(target: PortablePath, p: PortablePath) {
    return this.symlinkSync(target, p);
  }

  symlinkSync(target: PortablePath, p: PortablePath) {
    if (this.readOnly)
      throw errors.EROFS(`symlink '${target}' -> '${p}'`);

    const resolvedP = this.resolveFilename(`symlink '${target}' -> '${p}'`, p);

    if (this.listings.has(resolvedP))
      throw errors.EISDIR(`symlink '${target}' -> '${p}'`);
    if (this.entries.has(resolvedP))
      throw errors.EEXIST(`symlink '${target}' -> '${p}'`);

    const index = this.setFileSource(resolvedP, target);
    this.registerEntry(resolvedP, index);

    this.zip.restatEntry(index, {
      opsys: ZIP_OPSYS_UNIX,
      attributes: (constants.S_IFLNK | 0o777) << 16,
    });

    this.symlinkCount += 1;
  }

  readFilePromise(p: FSPath<PortablePath>, encoding?: null): Promise<Buffer>;
  readFilePromise(p: FSPath<PortablePath>, encoding: BufferEncoding): Promise<string>;
  readFilePromise(p: FSPath<PortablePath>, encoding?: BufferEncoding | null): Promise<Buffer | string>;
  async readFilePromise(p: FSPath<PortablePath>, encoding?: BufferEncoding | null) {
    // This is messed up regarding the TS signatures
    if (typeof encoding === `object`)
      // @ts-expect-error
      encoding = encoding ? encoding.encoding : undefined;

    const data = await this.readFileBuffer(p, {asyncDecompress: true});
    return encoding ? data.toString(encoding) : data;
  }

  readFileSync(p: FSPath<PortablePath>, encoding?: null): Buffer;
  readFileSync(p: FSPath<PortablePath>, encoding: BufferEncoding): string;
  readFileSync(p: FSPath<PortablePath>, encoding?: BufferEncoding | null): Buffer | string;
  readFileSync(p: FSPath<PortablePath>, encoding?: BufferEncoding | null) {
    // This is messed up regarding the TS signatures
    if (typeof encoding === `object`)
      // @ts-expect-error
      encoding = encoding ? encoding.encoding : undefined;

    const data = this.readFileBuffer(p);
    return encoding ? data.toString(encoding) : data;
  }

  private readFileBuffer(p: FSPath<PortablePath>): Buffer
  private readFileBuffer(p: FSPath<PortablePath>, opts: {asyncDecompress: false}): Buffer
  private readFileBuffer(p: FSPath<PortablePath>, opts: {asyncDecompress: true}): Promise<Buffer>
  private readFileBuffer(p: FSPath<PortablePath>, opts: {asyncDecompress: boolean}): Promise<Buffer> | Buffer
  private readFileBuffer(p: FSPath<PortablePath>, opts: {asyncDecompress: boolean} = {asyncDecompress: false}): Buffer | Promise<Buffer> {
    if (typeof p === `number`)
      p = this.fdToPath(p, `read`);

    const resolvedP = this.resolveFilename(`open '${p}'`, p);
    if (!this.entries.has(resolvedP) && !this.listings.has(resolvedP))
      throw errors.ENOENT(`open '${p}'`);

    // Ensures that the last component is a directory, if the user said so (even if it is we'll throw right after with EISDIR anyway)
    if (p[p.length - 1] === `/` && !this.listings.has(resolvedP))
      throw errors.ENOTDIR(`open '${p}'`);

    if (this.listings.has(resolvedP))
      throw errors.EISDIR(`read`);

    const entry = this.entries.get(resolvedP);
    if (entry === undefined)
      throw new Error(`Unreachable`);

    return this.getFileSource(entry, opts);
  }

  async readdirPromise(p: PortablePath): Promise<Array<Filename>>;
  async readdirPromise(p: PortablePath, opts: {withFileTypes: false} | null): Promise<Array<Filename>>;
  async readdirPromise(p: PortablePath, opts: {withFileTypes: true}): Promise<Array<statUtils.DirEntry>>;
  async readdirPromise(p: PortablePath, opts: {withFileTypes: boolean}): Promise<Array<Filename> | Array<statUtils.DirEntry>>;
  async readdirPromise(p: PortablePath, opts?: {withFileTypes?: boolean} | null): Promise<Array<string> | Array<statUtils.DirEntry>> {
    return this.readdirSync(p, opts as any);
  }

  readdirSync(p: PortablePath): Array<Filename>;
  readdirSync(p: PortablePath, opts: {withFileTypes: false} | null): Array<Filename>;
  readdirSync(p: PortablePath, opts: {withFileTypes: true}): Array<statUtils.DirEntry>;
  readdirSync(p: PortablePath, opts: {withFileTypes: boolean}): Array<Filename> | Array<statUtils.DirEntry>;
  readdirSync(p: PortablePath, opts?: {withFileTypes?: boolean} | null): Array<string> | Array<statUtils.DirEntry> {
    const resolvedP = this.resolveFilename(`scandir '${p}'`, p);
    if (!this.entries.has(resolvedP) && !this.listings.has(resolvedP))
      throw errors.ENOENT(`scandir '${p}'`);

    const directoryListing = this.listings.get(resolvedP);
    if (!directoryListing)
      throw errors.ENOTDIR(`scandir '${p}'`);

    const entries = [...directoryListing];
    if (!opts?.withFileTypes)
      return entries;

    return entries.map(name => {
      return Object.assign(this.statImpl(`lstat`, ppath.join(p, name)), {
        name,
      });
    });
  }

  async readlinkPromise(p: PortablePath) {
    const entry = this.prepareReadlink(p);
    return (await this.getFileSource(entry, {asyncDecompress: true})).toString() as PortablePath;
  }

  readlinkSync(p: PortablePath): PortablePath {
    const entry = this.prepareReadlink(p);
    return this.getFileSource(entry).toString() as PortablePath;
  }

  private prepareReadlink(p: PortablePath) {
    const resolvedP = this.resolveFilename(`readlink '${p}'`, p, false);
    if (!this.entries.has(resolvedP) && !this.listings.has(resolvedP))
      throw errors.ENOENT(`readlink '${p}'`);

    // Ensure that the last component is a directory (if it is we'll throw right after with EISDIR anyway)
    if (p[p.length - 1] === `/` && !this.listings.has(resolvedP))
      throw errors.ENOTDIR(`open '${p}'`);

    if (this.listings.has(resolvedP))
      throw errors.EINVAL(`readlink '${p}'`);

    const entry = this.entries.get(resolvedP);
    if (entry === undefined)
      throw new Error(`Unreachable`);

    if (!this.isSymbolicLink(entry))
      throw errors.EINVAL(`readlink '${p}'`);

    return entry;
  }

  async truncatePromise(p: PortablePath, len: number = 0) {
    const resolvedP = this.resolveFilename(`open '${p}'`, p);

    const index = this.entries.get(resolvedP);
    if (typeof index === `undefined`)
      throw errors.EINVAL(`open '${p}'`);

    const source = await this.getFileSource(index, {asyncDecompress: true});

    const truncated = Buffer.alloc(len, 0x00);
    source.copy(truncated);

    return await this.writeFilePromise(p, truncated);
  }

  truncateSync(p: PortablePath, len: number = 0) {
    const resolvedP = this.resolveFilename(`open '${p}'`, p);

    const index = this.entries.get(resolvedP);
    if (typeof index === `undefined`)
      throw errors.EINVAL(`open '${p}'`);

    const source = this.getFileSource(index);

    const truncated = Buffer.alloc(len, 0x00);
    source.copy(truncated);

    return this.writeFileSync(p, truncated);
  }

  async ftruncatePromise(fd: number, len?: number): Promise<void> {
    return this.truncatePromise(this.fdToPath(fd, `ftruncate`), len);
  }

  ftruncateSync(fd: number, len?: number): void {
    return this.truncateSync(this.fdToPath(fd, `ftruncateSync`), len);
  }

  watch(p: PortablePath, cb?: WatchCallback): Watcher;
  watch(p: PortablePath, opts: WatchOptions, cb?: WatchCallback): Watcher;
  watch(p: PortablePath, a?: WatchOptions | WatchCallback, b?: WatchCallback) {
    let persistent: boolean;

    switch (typeof a) {
      case `function`:
      case `string`:
      case `undefined`: {
        persistent = true;
      } break;

      default: {
        ({persistent = true} = a);
      } break;
    }

    if (!persistent)
      return {on: () => {}, close: () => {}};

    const interval = setInterval(() => {}, 24 * 60 * 60 * 1000);
    return {on: () => {}, close: () => {
      clearInterval(interval);
    }};
  }

  watchFile(p: PortablePath, cb: WatchFileCallback): StatWatcher;
  watchFile(p: PortablePath, opts: WatchFileOptions, cb: WatchFileCallback): StatWatcher;
  watchFile(p: PortablePath, a: WatchFileOptions | WatchFileCallback, b?: WatchFileCallback) {
    const resolvedP = ppath.resolve(PortablePath.root, p);

    return watchFile(this, resolvedP, a, b);
  }

  unwatchFile(p: PortablePath, cb?: WatchFileCallback): void {
    const resolvedP = ppath.resolve(PortablePath.root, p);

    return unwatchFile(this, resolvedP, cb);
  }
}
