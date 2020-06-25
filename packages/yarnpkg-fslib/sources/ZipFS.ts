import {Libzip}                                                                                    from '@yarnpkg/libzip';
import {ReadStream, Stats, WriteStream, constants}                                                 from 'fs';
import {PassThrough}                                                                               from 'stream';
import {isDate}                                                                                    from 'util';

import {CreateReadStreamOptions, CreateWriteStreamOptions, BasePortableFakeFS, ExtractHintOptions} from './FakeFS';
import {FakeFS, MkdirOptions, WriteFileOptions}                                                    from './FakeFS';
import {WatchOptions, WatchCallback, Watcher}                                                      from './FakeFS';
import {NodeFS}                                                                                    from './NodeFS';
import * as errors                                                                                 from './errors';
import {FSPath, PortablePath, npath, ppath, Filename}                                              from './path';

export type ZipCompression = `mixed` | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export const DEFAULT_COMPRESSION_LEVEL: ZipCompression = `mixed`;

const S_IFMT = 0o170000;

const S_IFDIR = 0o040000;
const S_IFREG = 0o100000;
const S_IFLNK = 0o120000;

class DirEntry {
  public name: Filename = `` as Filename;
  public mode: number = 0;

  isBlockDevice() {
    return false;
  }

  isCharacterDevice() {
    return false;
  }

  isDirectory() {
    return (this.mode & S_IFMT) === S_IFDIR;
  }

  isFIFO() {
    return false;
  }

  isFile() {
    return (this.mode & S_IFMT) === S_IFREG;
  }

  isSocket() {
    return false;
  }

  isSymbolicLink() {
    return (this.mode & S_IFMT) === S_IFLNK;
  }
}

class StatEntry {
  public dev: number = 0;
  public ino: number = 0;
  public mode: number = 0;
  public nlink: number = 1;
  public rdev: number = 0;
  public blocks: number = 1;

  isBlockDevice() {
    return false;
  }

  isCharacterDevice() {
    return false;
  }

  isDirectory() {
    return (this.mode & S_IFMT) === S_IFDIR;
  }

  isFIFO() {
    return false;
  }

  isFile() {
    return (this.mode & S_IFMT) === S_IFREG;
  }

  isSocket() {
    return false;
  }

  isSymbolicLink() {
    return (this.mode & S_IFMT) === S_IFLNK;
  }
}

function makeDefaultStats() {
  return Object.assign(new StatEntry(), {
    uid: 0,
    gid: 0,

    size: 0,
    blksize: 0,

    atimeMs: 0,
    mtimeMs: 0,
    ctimeMs: 0,
    birthtimeMs: 0,

    atime: new Date(0),
    mtime: new Date(0),
    ctime: new Date(0),
    birthtime: new Date(0),

    mode: S_IFREG | 0o644,
  });
}

export type ZipBufferOptions = {
  libzip: Libzip,
  readOnly?: boolean,
  stats?: Stats,
  level?: ZipCompression,
};

export type ZipPathOptions = ZipBufferOptions & {
  baseFs?: FakeFS<PortablePath>,
  create?: boolean,
};

function toUnixTimestamp(time: Date | string | number) {
  if (typeof time === `string` && String(+time) === time)
    return +time;

  // @ts-ignore
  if (Number.isFinite(time)) {
    if (time < 0) {
      return Date.now() / 1000;
    } else {
      return time;
    }
  }

  // convert to 123.456 UNIX timestamp
  if (isDate(time))
    return (time as Date).getTime() / 1000;

  throw new Error(`Invalid time`);
}

export class ZipFS extends BasePortableFakeFS {
  private readonly libzip: Libzip;

  private readonly baseFs: FakeFS<PortablePath> | null;
  private readonly path: PortablePath | null;

  private readonly stats: Stats;
  private readonly zip: number;
  private readonly lzSource: number | null = null;
  private readonly level: ZipCompression;

  private readonly listings: Map<PortablePath, Set<Filename>> = new Map();
  private readonly entries: Map<PortablePath, number> = new Map();

  private readonly fds: Map<number, {cursor: number, p: PortablePath}> = new Map();
  private nextFd: number = 0;

  private ready = false;
  private readOnly = false;

  constructor(p: PortablePath, opts: ZipPathOptions);
  /**
   * Create a ZipFS in memory
   * @param data If null; an empty zip file will be created
   */
  constructor(data: Buffer | null, opts: ZipBufferOptions);

  constructor(source: PortablePath | Buffer | null, opts: ZipPathOptions | ZipBufferOptions) {
    super();

    this.libzip = opts.libzip;

    const pathOptions = opts as ZipPathOptions;
    this.level = typeof pathOptions.level !== `undefined`
      ? pathOptions.level
      : DEFAULT_COMPRESSION_LEVEL;

    if (source === null) {
      source = Buffer.from([
        0x50, 0x4B, 0x05, 0x06,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00,
      ]);
    }

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
            this.stats = makeDefaultStats();
          } else {
            throw error;
          }
        }
      } else {
        this.stats = makeDefaultStats();
      }
    }

    const errPtr = this.libzip.malloc(4);

    try {
      let flags = 0;

      if (typeof source === `string` && pathOptions.create)
        flags |= this.libzip.ZIP_CREATE | this.libzip.ZIP_TRUNCATE;

      if (opts.readOnly) {
        flags |= this.libzip.ZIP_RDONLY;
        this.readOnly = true;
      }

      if (typeof source === `string`) {
        this.zip = this.libzip.open(npath.fromPortablePath(source), flags, errPtr);
      } else {
        const lzSource = this.allocateUnattachedSource(source);

        try {
          this.zip = this.libzip.openFromSource(lzSource, flags, errPtr);
          this.lzSource = lzSource;
        } catch (error) {
          this.libzip.source.free(lzSource);
          throw error;
        }
      }

      if (this.zip === 0) {
        const error = this.libzip.struct.errorS();
        this.libzip.error.initWithCode(error, this.libzip.getValue(errPtr, `i32`));

        throw new Error(this.libzip.error.strerror(error));
      }
    } finally {
      this.libzip.free(errPtr);
    }

    this.listings.set(PortablePath.root, new Set());

    const entryCount = this.libzip.getNumEntries(this.zip, 0);
    for (let t = 0; t < entryCount; ++t) {
      const raw = this.libzip.getName(this.zip, t, 0);
      if (ppath.isAbsolute(raw))
        continue;

      const p = ppath.resolve(PortablePath.root, raw);
      this.registerEntry(p, t);

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

  getBufferAndClose(): Buffer {
    if (!this.ready)
      throw errors.EBUSY(`archive closed, close`);

    if (!this.lzSource)
      throw new Error(`ZipFS was not created from a Buffer`);

    try {
      // Prevent close from cleaning up the source
      this.libzip.source.keep(this.lzSource);

      // Close the zip archive
      if (this.libzip.close(this.zip) === -1)
        throw new Error(this.libzip.error.strerror(this.libzip.getError(this.zip)));

      // Open the source for reading
      if (this.libzip.source.open(this.lzSource) === -1)
        throw new Error(this.libzip.error.strerror(this.libzip.source.error(this.lzSource)));

      // Move to the end of source
      if (this.libzip.source.seek(this.lzSource, 0, 0, this.libzip.SEEK_END) === -1)
        throw new Error(this.libzip.error.strerror(this.libzip.source.error(this.lzSource)));

      // Get the size of source
      const size = this.libzip.source.tell(this.lzSource);

      // Move to the start of source
      if (this.libzip.source.seek(this.lzSource, 0, 0, this.libzip.SEEK_SET) === -1)
        throw new Error(this.libzip.error.strerror(this.libzip.source.error(this.lzSource)));

      const buffer = this.libzip.malloc(size);
      if (!buffer)
        throw new Error(`Couldn't allocate enough memory`);

      try {
        const rc = this.libzip.source.read(this.lzSource, buffer, size);

        if (rc === -1)
          throw new Error(this.libzip.error.strerror(this.libzip.source.error(this.lzSource)));
        else if (rc < size)
          throw new Error(`Incomplete read`);
        else if (rc > size)
          throw new Error(`Overread`);

        const memory = this.libzip.HEAPU8.subarray(buffer, buffer + size);
        return Buffer.from(memory);
      }
      finally {
        this.libzip.free(buffer);
      }
    }
    finally {
      this.libzip.source.close(this.lzSource);
      this.libzip.source.free(this.lzSource);
      this.ready = false;
    }
  }

  saveAndClose() {
    if (!this.path || !this.baseFs)
      throw new Error(`ZipFS cannot be saved and must be discarded when loaded from a buffer`);

    if (!this.ready)
      throw errors.EBUSY(`archive closed, close`);

    if (this.readOnly) {
      this.discardAndClose();
      return;
    }

    const previousMod = this.baseFs.existsSync(this.path)
      ? this.baseFs.statSync(this.path).mode & 0o777
      : null;

    const rc = this.libzip.close(this.zip);
    if (rc === -1)
      throw new Error(this.libzip.error.strerror(this.libzip.getError(this.zip)));

    // this.libzip overrides the chmod when writing the archive, which is a weird
    // behavior I don't totally understand (plus the umask seems bogus in some
    // weird cases - maybe related to emscripten?)
    //
    // See also https://github.com/nih-at/libzip/issues/77
    if (previousMod === null)
      this.baseFs.chmodSync(this.path, this.stats.mode);
    else if (previousMod !== (this.baseFs.statSync(this.path).mode & 0o777))
      this.baseFs.chmodSync(this.path, previousMod);

    this.ready = false;
  }

  discardAndClose() {
    if (!this.ready)
      throw errors.EBUSY(`archive closed, close`);

    this.libzip.discard(this.zip);

    this.ready = false;
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

  async readPromise(fd: number, buffer: Buffer, offset?: number, length?: number, position?: number | null) {
    return this.readSync(fd, buffer, offset, length, position);
  }

  readSync(fd: number, buffer: Buffer, offset: number = 0, length: number = 0, position: number | null = -1) {
    const entry = this.fds.get(fd);
    if (typeof entry === `undefined`)
      throw errors.EBADF(`read`);

    let realPosition;
    if (position === -1 || position === null)
      realPosition = entry.cursor;
    else
      realPosition = position;

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

    const stream = Object.assign(new PassThrough(), {
      bytesRead: 0,
      path: p,
      close: () => {
        clearImmediate(immediate);
      },
    });

    const immediate = setImmediate(() => {
      try {
        const data = this.readFileSync(p, encoding);

        stream.bytesRead = data.length;
        stream.write(data);
        stream.end();
      } catch (error) {
        stream.emit(`error`, error);
        stream.end();
      }
    });

    return stream;
  }

  createWriteStream(p: PortablePath | null, {encoding}: CreateWriteStreamOptions = {}): WriteStream {
    if (this.readOnly)
      throw errors.EROFS(`open '${p}'`);

    if (p === null)
      throw new Error(`Unimplemented`);

    const stream = Object.assign(new PassThrough(), {
      bytesWritten: 0,
      path: p,
      close: () => {
        stream.end();
      },
    });

    const chunks: Array<Buffer> = [];

    stream.on(`data`, chunk => {
      const chunkBuffer = Buffer.from(chunk);
      stream.bytesWritten += chunkBuffer.length;
      chunks.push(chunkBuffer);
    });

    stream.on(`end`, () => {
      this.writeFileSync(p, Buffer.concat(chunks), encoding);
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
    let resolvedP;

    try {
      resolvedP = this.resolveFilename(`stat '${p}'`, p);
    } catch (error) {
      return false;
    }

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

  async statPromise(p: PortablePath) {
    return this.statSync(p);
  }

  statSync(p: PortablePath) {
    const resolvedP = this.resolveFilename(`stat '${p}'`, p);

    if (!this.entries.has(resolvedP) && !this.listings.has(resolvedP))
      throw errors.ENOENT(`stat '${p}'`);

    if (p[p.length - 1] === `/` && !this.listings.has(resolvedP))
      throw errors.ENOTDIR(`stat '${p}'`);

    return this.statImpl(`stat '${p}'`, resolvedP);
  }

  async lstatPromise(p: PortablePath) {
    return this.lstatSync(p);
  }

  lstatSync(p: PortablePath) {
    const resolvedP = this.resolveFilename(`lstat '${p}'`, p, false);

    if (!this.entries.has(resolvedP) && !this.listings.has(resolvedP))
      throw errors.ENOENT(`lstat '${p}'`);

    if (p[p.length - 1] === `/` && !this.listings.has(resolvedP))
      throw errors.ENOTDIR(`lstat '${p}'`);

    return this.statImpl(`lstat '${p}'`, resolvedP);
  }

  private statImpl(reason: string, p: PortablePath): Stats {
    const entry = this.entries.get(p);

    // File, or explicit directory
    if (typeof entry !== `undefined`) {
      const stat = this.libzip.struct.statS();

      const rc = this.libzip.statIndex(this.zip, entry, 0, 0, stat);
      if (rc === -1)
        throw new Error(this.libzip.error.strerror(this.libzip.getError(this.zip)));

      const uid = this.stats.uid;
      const gid = this.stats.gid;

      const size = (this.libzip.struct.statSize(stat) >>> 0);
      const blksize = 512;
      const blocks = Math.ceil(size / blksize);

      const mtimeMs = (this.libzip.struct.statMtime(stat) >>> 0) * 1000;
      const atimeMs = mtimeMs;
      const birthtimeMs = mtimeMs;
      const ctimeMs = mtimeMs;

      const atime = new Date(atimeMs);
      const birthtime = new Date(birthtimeMs);
      const ctime = new Date(ctimeMs);
      const mtime = new Date(mtimeMs);

      const type = this.listings.has(p)
        ? S_IFDIR
        : this.isSymbolicLink(entry)
          ? S_IFLNK
          : S_IFREG;

      const defaultMode = type === S_IFDIR
        ? 0o755
        : 0o644;

      const mode = type | (this.getUnixMode(entry, defaultMode) & 0o777);

      return Object.assign(new StatEntry(), {uid, gid, size, blksize, blocks, atime, birthtime, ctime, mtime, atimeMs, birthtimeMs, ctimeMs, mtimeMs, mode});
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

      const mode = S_IFDIR | 0o755;

      return Object.assign(new StatEntry(), {uid, gid, size, blksize, blocks, atime, birthtime, ctime, mtime, atimeMs, birthtimeMs, ctimeMs, mtimeMs, mode});
    }

    throw new Error(`Unreachable`);
  }

  private getUnixMode(index: number, defaultMode: number) {
    const rc = this.libzip.file.getExternalAttributes(this.zip, index, 0, 0, this.libzip.uint08S, this.libzip.uint32S);
    if (rc === -1)
      throw new Error(this.libzip.error.strerror(this.libzip.getError(this.zip)));

    const opsys = this.libzip.getValue(this.libzip.uint08S, `i8`) >>> 0;
    if (opsys !== this.libzip.ZIP_OPSYS_UNIX)
      return defaultMode;

    return this.libzip.getValue(this.libzip.uint32S, `i32`) >>> 16;
  }

  private registerListing(p: PortablePath) {
    let listing = this.listings.get(p);
    if (listing)
      return listing;

    const parentListing = this.registerListing(ppath.dirname(p));
    listing = new Set();

    parentListing.add(ppath.basename(p));
    this.listings.set(p, listing);

    return listing;
  }

  private registerEntry(p: PortablePath, index: number) {
    const parentListing = this.registerListing(ppath.dirname(p));
    parentListing.add(ppath.basename(p));

    this.entries.set(p, index);
  }

  private resolveFilename(reason: string, p: PortablePath, resolveLastComponent: boolean = true): PortablePath {
    if (!this.ready)
      throw errors.EBUSY(`archive closed, ${reason}`);

    let resolvedP = ppath.resolve(PortablePath.root, p);
    if (resolvedP === `/`)
      return PortablePath.root;

    const fileIndex = this.entries.get(resolvedP);
    if (resolveLastComponent && fileIndex !== undefined) {
      if (this.isSymbolicLink(fileIndex)) {
        const target = this.getFileSource(fileIndex).toString() as PortablePath;
        return this.resolveFilename(reason, ppath.resolve(ppath.dirname(resolvedP), target), true);
      } else {
        return resolvedP;
      }
    }

    while (true) {
      const parentP = this.resolveFilename(reason, ppath.dirname(resolvedP), true);

      const isDir = this.listings.has(parentP);
      const doesExist = this.entries.has(parentP);

      if (!isDir && !doesExist)
        throw errors.ENOENT(reason);
      if (!isDir)
        throw errors.ENOTDIR(reason);

      resolvedP = ppath.resolve(parentP, ppath.basename(resolvedP));
      if (!resolveLastComponent)
        break;

      const index = this.libzip.name.locate(this.zip, resolvedP.slice(1));
      if (index === -1)
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

  private allocateBuffer(content: string | Buffer | ArrayBuffer | DataView) {
    if (!Buffer.isBuffer(content))
      content = Buffer.from(content as any);

    const buffer = this.libzip.malloc(content.byteLength);
    if (!buffer)
      throw new Error(`Couldn't allocate enough memory`);

    // Copy the file into the Emscripten heap
    const heap = new Uint8Array(this.libzip.HEAPU8.buffer, buffer, content.byteLength);
    heap.set(content as any);

    return {buffer, byteLength: content.byteLength};
  }

  private allocateUnattachedSource(content: string | Buffer | ArrayBuffer | DataView) {
    const error = this.libzip.struct.errorS();

    const {buffer, byteLength} = this.allocateBuffer(content);
    const source = this.libzip.source.fromUnattachedBuffer(buffer, byteLength, 0, true, error);

    if (source === 0) {
      this.libzip.free(error);
      throw new Error(this.libzip.error.strerror(error));
    }

    return source;
  }

  private allocateSource(content: string | Buffer | ArrayBuffer | DataView) {
    const {buffer, byteLength} = this.allocateBuffer(content);
    const source = this.libzip.source.fromBuffer(this.zip, buffer, byteLength, 0, true);

    if (source === 0) {
      this.libzip.free(buffer);
      throw new Error(this.libzip.error.strerror(this.libzip.getError(this.zip)));
    }

    return source;
  }

  private setFileSource(p: PortablePath, content: string | Buffer | ArrayBuffer | DataView) {
    const target = ppath.relative(PortablePath.root, p);
    const lzSource = this.allocateSource(content);

    try {
      const newIndex = this.libzip.file.add(this.zip, target, lzSource, this.libzip.ZIP_FL_OVERWRITE);
      if (this.level !== `mixed`) {
        // Use store for level 0, and deflate for 1..9
        let method;
        if (this.level === 0)
          method = this.libzip.ZIP_CM_STORE;
        else
          method = this.libzip.ZIP_CM_DEFLATE;

        const rc = this.libzip.file.setCompression(this.zip, newIndex, 0, method, this.level);
        if (rc === -1) {
          throw new Error(this.libzip.error.strerror(this.libzip.getError(this.zip)));
        }
      }

      return newIndex;
    } catch (error) {
      this.libzip.source.free(lzSource);
      throw error;
    }
  }

  private isSymbolicLink(index: number) {
    const attrs = this.libzip.file.getExternalAttributes(this.zip, index, 0, 0, this.libzip.uint08S, this.libzip.uint32S);
    if (attrs === -1)
      throw new Error(this.libzip.error.strerror(this.libzip.getError(this.zip)));

    const opsys = this.libzip.getValue(this.libzip.uint08S, `i8`) >>> 0;
    if (opsys !== this.libzip.ZIP_OPSYS_UNIX)
      return false;

    const attributes = this.libzip.getValue(this.libzip.uint32S, `i32`) >>> 16;
    return (attributes & S_IFMT) === S_IFLNK;
  }

  private getFileSource(index: number) {
    const stat = this.libzip.struct.statS();

    const rc = this.libzip.statIndex(this.zip, index, 0, 0, stat);
    if (rc === -1)
      throw new Error(this.libzip.error.strerror(this.libzip.getError(this.zip)));

    const size = this.libzip.struct.statSize(stat);
    const buffer = this.libzip.malloc(size);

    try {
      const file = this.libzip.fopenIndex(this.zip, index, 0, 0);
      if (file === 0)
        throw new Error(this.libzip.error.strerror(this.libzip.getError(this.zip)));

      try {
        const rc = this.libzip.fread(file, buffer, size, 0);

        if (rc === -1)
          throw new Error(this.libzip.error.strerror(this.libzip.file.getError(file)));
        else if (rc < size)
          throw new Error(`Incomplete read`);
        else if (rc > size)
          throw new Error(`Overread`);

        const memory = this.libzip.HEAPU8.subarray(buffer, buffer + size);
        const data = Buffer.from(memory);

        return data;
      } finally {
        this.libzip.fclose(file);
      }
    } finally {
      this.libzip.free(buffer);
    }
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

    const oldMod = this.getUnixMode(entry, S_IFREG | 0o000);
    const newMod = oldMod & (~0o777) | mask;

    const rc = this.libzip.file.setExternalAttributes(this.zip, entry, 0, 0, this.libzip.ZIP_OPSYS_UNIX, newMod << 16);
    if (rc === -1) {
      throw new Error(this.libzip.error.strerror(this.libzip.getError(this.zip)));
    }
  }

  async renamePromise(oldP: PortablePath, newP: PortablePath) {
    return this.renameSync(oldP, newP);
  }

  renameSync(oldP: PortablePath, newP: PortablePath): never {
    throw new Error(`Unimplemented`);
  }

  async copyFilePromise(sourceP: PortablePath, destP: PortablePath, flags?: number) {
    return this.copyFileSync(sourceP, destP, flags);
  }

  copyFileSync(sourceP: PortablePath, destP: PortablePath, flags: number = 0) {
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

    const source = this.getFileSource(indexSource);
    const newIndex = this.setFileSource(resolvedDestP, source);

    if (newIndex !== indexDest) {
      this.registerEntry(resolvedDestP, newIndex);
    }
  }

  async appendFilePromise(p: FSPath<PortablePath>, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return this.appendFileSync(p, content, opts);
  }

  appendFileSync(p: FSPath<PortablePath>, content: string | Buffer | ArrayBuffer | DataView, opts: WriteFileOptions = {}) {
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

  async writeFilePromise(p: FSPath<PortablePath>, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return this.writeFileSync(p, content, opts);
  }

  writeFileSync(p: FSPath<PortablePath>, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    if (typeof p !== `string`)
      throw errors.EBADF(`read`);

    if (this.readOnly)
      throw errors.EROFS(`open '${p}'`);

    const resolvedP = this.resolveFilename(`open '${p}'`, p);
    if (this.listings.has(resolvedP))
      throw errors.EISDIR(`open '${p}'`);

    const index = this.entries.get(resolvedP);
    if (index !== undefined && typeof opts === `object` && opts.flag && opts.flag.includes(`a`))
      content = Buffer.concat([this.getFileSource(index), Buffer.from(content as any)]);

    let encoding = null;

    if (typeof opts === `string`)
      encoding = opts;
    else if (typeof opts === `object` && opts.encoding)
      encoding = opts.encoding;

    if (encoding !== null)
      content = content.toString(encoding);

    const newIndex = this.setFileSource(resolvedP, content);
    if (newIndex !== index) {
      this.registerEntry(resolvedP, newIndex);
    }
  }

  async unlinkPromise(p: PortablePath) {
    return this.unlinkSync(p);
  }

  unlinkSync(p: PortablePath) {
    throw new Error(`Unimplemented`);
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

    const rc = this.libzip.file.setMtime(this.zip, entry, 0, toUnixTimestamp(mtime), 0);
    if (rc === -1) {
      throw new Error(this.libzip.error.strerror(this.libzip.getError(this.zip)));
    }
  }

  async mkdirPromise(p: PortablePath, opts?: MkdirOptions) {
    return this.mkdirSync(p, opts);
  }

  mkdirSync(p: PortablePath, {mode = 0o755, recursive = false}: MkdirOptions = {}) {
    if (recursive) {
      this.mkdirpSync(p, {chmod: mode});
      return;
    }

    if (this.readOnly)
      throw errors.EROFS(`mkdir '${p}'`);

    const resolvedP = this.resolveFilename(`mkdir '${p}'`, p);

    if (this.entries.has(resolvedP) || this.listings.has(resolvedP))
      throw errors.EEXIST(`mkdir '${p}'`);

    this.hydrateDirectory(resolvedP);
    this.chmodSync(resolvedP, mode);
  }

  async rmdirPromise(p: PortablePath) {
    return this.rmdirSync(p);
  }

  rmdirSync(p: PortablePath) {
    throw new Error(`Unimplemented`);
  }

  private hydrateDirectory(resolvedP: PortablePath) {
    const index = this.libzip.dir.add(this.zip, ppath.relative(PortablePath.root, resolvedP));
    if (index === -1)
      throw new Error(this.libzip.error.strerror(this.libzip.getError(this.zip)));

    this.registerListing(resolvedP);
    this.registerEntry(resolvedP, index);

    return index;
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

    const rc = this.libzip.file.setExternalAttributes(this.zip, index, 0, 0, this.libzip.ZIP_OPSYS_UNIX, (0o120000 | 0o777) << 16);
    if (rc === -1) {
      throw new Error(this.libzip.error.strerror(this.libzip.getError(this.zip)));
    }
  }

  readFilePromise(p: FSPath<PortablePath>, encoding: 'utf8'): Promise<string>;
  readFilePromise(p: FSPath<PortablePath>, encoding?: string): Promise<Buffer>;
  async readFilePromise(p: PortablePath, encoding?: string) {
    // This weird switch is required to tell TypeScript that the signatures are proper (otherwise it thinks that only the generic one is covered)
    switch (encoding) {
      case `utf8`:
        return this.readFileSync(p, encoding);
      default:
        return this.readFileSync(p, encoding);
    }
  }

  readFileSync(p: FSPath<PortablePath>, encoding: 'utf8'): string;
  readFileSync(p: FSPath<PortablePath>, encoding?: string): Buffer;
  readFileSync(p: FSPath<PortablePath>, encoding?: string) {
    if (typeof p !== `string`)
      throw errors.EBADF(`read`);

    // This is messed up regarding the TS signatures
    if (typeof encoding === `object`)
      // @ts-ignore
      encoding = encoding ? encoding.encoding : undefined;

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

    const data = this.getFileSource(entry);

    return encoding ? data.toString(encoding) : data;
  }

  async readdirPromise(p: PortablePath): Promise<Array<Filename>>;
  async readdirPromise(p: PortablePath, opts: {withFileTypes: false}): Promise<Array<Filename>>;
  async readdirPromise(p: PortablePath, opts: {withFileTypes: true}): Promise<Array<DirEntry>>;
  async readdirPromise(p: PortablePath, opts: {withFileTypes: boolean}): Promise<Array<Filename> | Array<DirEntry>>;
  async readdirPromise(p: PortablePath, {withFileTypes}: {withFileTypes?: boolean} = {}): Promise<Array<string> | Array<DirEntry>> {
    return this.readdirSync(p, {withFileTypes: withFileTypes as any});
  }

  readdirSync(p: PortablePath): Array<Filename>;
  readdirSync(p: PortablePath, opts: {withFileTypes: false}): Array<Filename>;
  readdirSync(p: PortablePath, opts: {withFileTypes: true}): Array<DirEntry>;
  readdirSync(p: PortablePath, opts: {withFileTypes: boolean}): Array<Filename> | Array<DirEntry>;
  readdirSync(p: PortablePath, {withFileTypes}: {withFileTypes?: boolean} = {}): Array<string> | Array<DirEntry> {
    const resolvedP = this.resolveFilename(`scandir '${p}'`, p);
    if (!this.entries.has(resolvedP) && !this.listings.has(resolvedP))
      throw errors.ENOENT(`scandir '${p}'`);

    const directoryListing = this.listings.get(resolvedP);
    if (!directoryListing)
      throw errors.ENOTDIR(`scandir '${p}'`);

    const entries = [...directoryListing];
    if (!withFileTypes)
      return entries;

    return entries.map(name => {
      return Object.assign(this.statImpl(`lstat`, ppath.join(p, name)), {
        name,
      });
    });
  }

  async readlinkPromise(p: PortablePath) {
    return this.readlinkSync(p);
  }

  readlinkSync(p: PortablePath): PortablePath {
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

    const rc = this.libzip.file.getExternalAttributes(this.zip, entry, 0, 0, this.libzip.uint08S, this.libzip.uint32S);
    if (rc === -1)
      throw new Error(this.libzip.error.strerror(this.libzip.getError(this.zip)));

    const opsys = this.libzip.getValue(this.libzip.uint08S, `i8`) >>> 0;
    if (opsys !== this.libzip.ZIP_OPSYS_UNIX)
      throw errors.EINVAL(`readlink '${p}'`);

    const attributes = this.libzip.getValue(this.libzip.uint32S, `i32`) >>> 16;
    if ((attributes & 0o170000) !== 0o120000)
      throw errors.EINVAL(`readlink '${p}'`);

    return this.getFileSource(entry).toString() as PortablePath;
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
        // @ts-ignore
        ({persistent = true} = a);
      } break;
    }

    if (!persistent)
      return {on: () => {}, close: () => {}};

    const interval = setInterval(() => {}, 24 * 60 * 60 * 1000);
    return {on: () => {}, close: () => {clearInterval(interval);}};
  }
}
