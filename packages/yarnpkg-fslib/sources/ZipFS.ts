import libzip                                                                  from '@yarnpkg/libzip';
import {ReadStream, Stats, WriteStream, constants}                             from 'fs';
import {PassThrough}                                                           from 'stream';
import {isDate}                                                                from 'util';

import {CreateReadStreamOptions, CreateWriteStreamOptions, BasePortableFakeFS} from './FakeFS';
import {FakeFS, MkdirOptions, WriteFileOptions}                                from './FakeFS';
import {WatchOptions, WatchCallback, Watcher}                                  from './FakeFS';
import {NodeFS}                                                                from './NodeFS';
import * as errors                                                             from './errors';
import {FSPath, PortablePath, npath, ppath, Filename}                          from './path';

const S_IFMT = 0o170000;

const S_IFDIR = 0o040000;
const S_IFREG = 0o100000;
const S_IFLNK = 0o120000;

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
  readOnly?: boolean,
  stats?: Stats,
};

export type ZipPathOptions = ZipBufferOptions & {
  baseFs?: FakeFS<PortablePath>,
  create?: boolean,
};

function toUnixTimestamp(time: Date | string | number) {
  if (typeof time === 'string' && String(+time) === time)
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
  private readonly baseFs: FakeFS<PortablePath> | null;
  private readonly path: PortablePath | null;

  private readonly stats: Stats;
  private readonly zip: number;

  private readonly listings: Map<PortablePath, Set<Filename>> = new Map();
  private readonly entries: Map<PortablePath, number> = new Map();

  private readonly fds: Map<number, {cursor: number, p: PortablePath}> = new Map();
  private nextFd: number = 0;

  private ready = false;
  private readOnly = false;

  constructor(p: PortablePath, opts?: ZipPathOptions);
  constructor(data: Buffer, opts?: ZipBufferOptions);

  constructor(source: PortablePath | Buffer, opts: ZipPathOptions | ZipBufferOptions = {}) {
    super();

    const pathOptions = opts as ZipPathOptions;

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

    const errPtr = libzip.malloc(4);

    try {
      let flags = 0;

      if (typeof source === `string` && pathOptions.create)
        flags |= libzip.ZIP_CREATE | libzip.ZIP_TRUNCATE;

      if (opts.readOnly) {
        flags |= libzip.ZIP_RDONLY;
        this.readOnly = true;
      }

      if (typeof source === `string`) {
        this.zip = libzip.open(npath.fromPortablePath(source), flags, errPtr);
      } else {
        const lzSource = this.allocateUnattachedSource(source);

        try {
          this.zip = libzip.openFromSource(lzSource, flags, errPtr);
        } catch (error) {
          libzip.source.free(lzSource);
          throw error;
        }
      }

      if (this.zip === 0) {
        const error = libzip.struct.errorS();
        libzip.error.initWithCode(error, libzip.getValue(errPtr, `i32`));

        throw new Error(libzip.error.strerror(error));
      }
    } finally {
      libzip.free(errPtr);
    }

    this.listings.set(PortablePath.root, new Set());

    const entryCount = libzip.getNumEntries(this.zip, 0);
    for (let t = 0; t < entryCount; ++t) {
      const raw = libzip.getName(this.zip, t, 0);
      if (ppath.isAbsolute(raw))
        continue;

      const p = ppath.resolve(PortablePath.root, raw);
      this.registerEntry(p, t);

      // If the raw path is a directory, register it
      // to prevent empty folder being skipped
      if (raw.endsWith('/')) {
        this.registerListing(p);
      }
    }

    this.ready = true;
  }

  getAllFiles() {
    return Array.from(this.entries.keys());
  }

  getRealPath() {
    if (!this.path)
      throw new Error(`ZipFS don't have real paths when loaded from a buffer`);

    return this.path;
  }

  saveAndClose() {
    if (!this.path || !this.baseFs)
      throw new Error(`ZipFS cannot be saved and must be discarded when loaded from a buffer`);

    if (!this.ready)
      throw errors.EBUSY(`archive closed, close`);

    if (this.readOnly)
      return this.discardAndClose();

    const previousMod = this.baseFs.existsSync(this.path)
      ? this.baseFs.statSync(this.path).mode & 0o777
      : null;

    const rc = libzip.close(this.zip);
    if (rc === -1)
      throw new Error(libzip.error.strerror(libzip.getError(this.zip)));

    // Libzip overrides the chmod when writing the archive, which is a weird
    // behavior I don't totally understand (plus the umask seems bogus in some
    // weird cases - maybe related to emscripten?)
    //
    // See also https://github.com/nih-at/libzip/issues/77
    if (previousMod !== null && previousMod !== (this.baseFs.statSync(this.path).mode & 0o777))
      this.baseFs.chmodSync(this.path, previousMod);

    this.ready = false;
  }

  discardAndClose() {
    if (!this.ready)
      throw errors.EBUSY(`archive closed, close`);

    libzip.discard(this.zip);

    this.ready = false;
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
    if (position === -1)
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

    const entry = this.entries.get(p);

    if (entry !== undefined) {
      const stat = libzip.struct.statS();

      const rc = libzip.statIndex(this.zip, entry, 0, 0, stat);
      if (rc === -1)
        throw new Error(libzip.error.strerror(libzip.getError(this.zip)));

      const uid = this.stats.uid;
      const gid = this.stats.gid;

      const size = (libzip.struct.statSize(stat) >>> 0);
      const blksize = 512;
      const blocks = Math.ceil(size / blksize);

      const mtimeMs = (libzip.struct.statMtime(stat) >>> 0) * 1000;
      const atimeMs = mtimeMs;
      const birthtimeMs = mtimeMs;
      const ctimeMs = mtimeMs;

      const atime = new Date(atimeMs);
      const birthtime = new Date(birthtimeMs);
      const ctime = new Date(ctimeMs);
      const mtime = new Date(mtimeMs);

      const mode = this.getUnixMode(entry, S_IFREG | 0o644);

      return Object.assign(new StatEntry(), {uid, gid, size, blksize, blocks, atime, birthtime, ctime, mtime, atimeMs, birthtimeMs, ctimeMs, mtimeMs, mode});
    }

    throw new Error(`Unreachable`);
  }

  private getUnixMode(index: number, defaultMode: number) {
    const rc = libzip.file.getExternalAttributes(this.zip, index, 0, 0, libzip.uint08S, libzip.uint32S);
    if (rc === -1)
      throw new Error(libzip.error.strerror(libzip.getError(this.zip)));

    const opsys = libzip.getValue(libzip.uint08S, `i8`) >>> 0;
    if (opsys !== libzip.ZIP_OPSYS_UNIX)
      return defaultMode;

    return libzip.getValue(libzip.uint32S, `i32`) >>> 16;
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

      const index = libzip.name.locate(this.zip, resolvedP);
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

    const buffer = libzip.malloc(content.byteLength);
    if (!buffer)
      throw new Error(`Couldn't allocate enough memory`);

    // Copy the file into the Emscripten heap
    const heap = new Uint8Array(libzip.HEAPU8.buffer, buffer, content.byteLength);
    heap.set(content as any);

    return {buffer, byteLength: content.byteLength};
  }

  private allocateUnattachedSource(content: string | Buffer | ArrayBuffer | DataView) {
    const error = libzip.struct.errorS();

    const {buffer, byteLength} = this.allocateBuffer(content);
    const source = libzip.source.fromUnattachedBuffer(buffer, byteLength, 0, true, error);

    if (source === 0) {
      libzip.free(error);
      throw new Error(libzip.error.strerror(error));
    }

    return source;
  }

  private allocateSource(content: string | Buffer | ArrayBuffer | DataView) {
    const {buffer, byteLength} = this.allocateBuffer(content);
    const source = libzip.source.fromBuffer(this.zip, buffer, byteLength, 0, true);

    if (source === 0) {
      libzip.free(buffer);
      throw new Error(libzip.error.strerror(libzip.getError(this.zip)));
    }

    return source;
  }

  private setFileSource(p: PortablePath, content: string | Buffer | ArrayBuffer | DataView) {
    const target = ppath.relative(PortablePath.root, p);
    const lzSource = this.allocateSource(content);

    try {
      return libzip.file.add(this.zip, target, lzSource, libzip.ZIP_FL_OVERWRITE);
    } catch (error) {
      libzip.source.free(lzSource);
      throw error;
    }
  }

  private isSymbolicLink(index: number) {
    const attrs = libzip.file.getExternalAttributes(this.zip, index, 0, 0, libzip.uint08S, libzip.uint32S);
    if (attrs === -1)
      throw new Error(libzip.error.strerror(libzip.getError(this.zip)));

    const opsys = libzip.getValue(libzip.uint08S, `i8`) >>> 0;
    if (opsys !== libzip.ZIP_OPSYS_UNIX)
      return false;

    const attributes = libzip.getValue(libzip.uint32S, `i32`) >>> 16;
    return (attributes & S_IFMT) === S_IFLNK;
  }

  private getFileSource(index: number) {
    const stat = libzip.struct.statS();

    const rc = libzip.statIndex(this.zip, index, 0, 0, stat);
    if (rc === -1)
      throw new Error(libzip.error.strerror(libzip.getError(this.zip)));

    const size = libzip.struct.statSize(stat);
    const buffer = libzip.malloc(size);

    try {
      const file = libzip.fopenIndex(this.zip, index, 0, 0);
      if (file === 0)
        throw new Error(libzip.error.strerror(libzip.getError(this.zip)));

      try {
        const rc = libzip.fread(file, buffer, size, 0);

        if (rc === -1)
          throw new Error(libzip.error.strerror(libzip.file.getError(file)));
        else if (rc < size)
          throw new Error(`Incomplete read`);
        else if (rc > size)
          throw new Error(`Overread`);

        const memory = libzip.HEAPU8.subarray(buffer, buffer + size);
        const data = Buffer.from(memory);

        return data;
      } finally {
        libzip.fclose(file);
      }
    } finally {
      libzip.free(buffer);
    }
  }

  async chmodPromise(p: PortablePath, mask: number) {
    return this.chmodSync(p, mask);
  }

  chmodSync(p: PortablePath, mask: number) {
    if (this.readOnly)
      throw errors.EROFS(`chmod '${p}'`);

    const resolvedP = this.resolveFilename(`chmod '${p}'`, p, false);

    // We silently ignore chmod requests for directories
    if (this.listings.has(resolvedP))
      return;

    const entry = this.entries.get(resolvedP);
    if (entry === undefined)
      throw new Error(`Unreachable`);

    const oldMod = this.getUnixMode(entry, S_IFREG | 0o000);
    const newMod = oldMod & (~0o777) | mask;

    const rc = libzip.file.setExternalAttributes(this.zip, entry, 0, 0, libzip.ZIP_OPSYS_UNIX, newMod << 16);
    if (rc === -1) {
      throw new Error(libzip.error.strerror(libzip.getError(this.zip)));
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

    const resolvedP = this.resolveFilename(`chmod '${p}'`, p);

    return this.utimesImpl(resolvedP, mtime);
  }

  async lutimesPromise(p: PortablePath, atime: Date | string | number, mtime: Date | string | number) {
    return this.lutimesSync(p, atime, mtime);
  }

  lutimesSync(p: PortablePath, atime: Date | string | number, mtime: Date | string | number) {
    if (this.readOnly)
      throw errors.EROFS(`lutimes '${p}'`);

    const resolvedP = this.resolveFilename(`chmod '${p}'`, p, false);

    return this.utimesImpl(resolvedP, mtime);
  }

  private utimesImpl(resolvedP: PortablePath, mtime: Date | string | number) {
    if (this.listings.has(resolvedP))
      if (!this.entries.has(resolvedP))
        this.hydrateDirectory(resolvedP);

    const entry = this.entries.get(resolvedP);
    if (entry === undefined)
      throw new Error(`Unreachable`);

    const rc = libzip.file.setMtime(this.zip, entry, 0, toUnixTimestamp(mtime), 0);
    if (rc === -1) {
      throw new Error(libzip.error.strerror(libzip.getError(this.zip)));
    }
  }

  async mkdirPromise(p: PortablePath, opts?: MkdirOptions) {
    return this.mkdirSync(p, opts);
  }

  mkdirSync(p: PortablePath, opts?: MkdirOptions) {
    if (opts && opts.recursive)
      return this.mkdirpSync(p, {chmod: opts.mode});

    if (this.readOnly)
      throw errors.EROFS(`mkdir '${p}'`);

    const resolvedP = this.resolveFilename(`mkdir '${p}'`, p);

    if (this.entries.has(resolvedP) || this.listings.has(resolvedP))
      throw errors.EEXIST(`mkdir '${p}'`);

    this.hydrateDirectory(resolvedP);
  }

  async rmdirPromise(p: PortablePath) {
    return this.rmdirSync(p);
  }

  rmdirSync(p: PortablePath) {
    throw new Error(`Unimplemented`);
  }

  private hydrateDirectory(resolvedP: PortablePath) {
    const index = libzip.dir.add(this.zip, ppath.relative(PortablePath.root, resolvedP));
    if (index === -1)
      throw new Error(libzip.error.strerror(libzip.getError(this.zip)));

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

    const rc = libzip.file.setExternalAttributes(this.zip, index, 0, 0, libzip.ZIP_OPSYS_UNIX, (0o120000 | 0o777) << 16);
    if (rc === -1) {
      throw new Error(libzip.error.strerror(libzip.getError(this.zip)));
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

  async readdirPromise(p: PortablePath) {
    return this.readdirSync(p);
  }

  readdirSync(p: PortablePath): Array<Filename> {
    const resolvedP = this.resolveFilename(`scandir '${p}'`, p);
    if (!this.entries.has(resolvedP) && !this.listings.has(resolvedP))
      throw errors.ENOENT(`scandir '${p}'`);

    const directoryListing = this.listings.get(resolvedP);
    if (!directoryListing)
      throw errors.ENOTDIR(`scandir '${p}'`);

    return Array.from(directoryListing);
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

    const rc = libzip.file.getExternalAttributes(this.zip, entry, 0, 0, libzip.uint08S, libzip.uint32S);
    if (rc === -1)
      throw new Error(libzip.error.strerror(libzip.getError(this.zip)));

    const opsys = libzip.getValue(libzip.uint08S, `i8`) >>> 0;
    if (opsys !== libzip.ZIP_OPSYS_UNIX)
      throw errors.EINVAL(`readlink '${p}'`);

    const attributes = libzip.getValue(libzip.uint32S, `i32`) >>> 16;
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
};
