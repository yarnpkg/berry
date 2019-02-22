import libzip                                              from '@berry/libzip';
import {ReadStream, Stats, WriteStream, constants}         from 'fs';
import {posix}                                             from 'path';
import {PassThrough}                                       from 'stream';
import {isDate}                                            from 'util';

import {CreateReadStreamOptions, CreateWriteStreamOptions} from './FakeFS';
import {FakeFS, WriteFileOptions}                          from './FakeFS';
import {NodeFS}                                            from './NodeFS';

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

export type Options = {
  baseFs?: FakeFS,
  create?: boolean,
  readOnly?: boolean,
  stats?: Stats,
};

function toUnixTimestamp(time: Date | string | number) {
  if (typeof time === 'string' && String(+time) === time) {
    return +time;
  }
  // @ts-ignore
  if (Number.isFinite(time)) {
    if (time < 0) {
      return Date.now() / 1000;
    } else {
      return time;
    }
  }
  if (isDate(time)) {
    // convert to 123.456 UNIX timestamp
    // @ts-ignore
    return time.getTime() / 1000;
  }
  throw new Error(`Invalid time`);
}

export class ZipFS extends FakeFS {
  private readonly path: string;

  private readonly baseFs: FakeFS;

  private readonly stats: Stats;
  private readonly zip: number;

  private readonly listings: Map<string, Set<string>> = new Map();
  private readonly entries: Map<string, number> = new Map();

  private ready = false;

  constructor(p: string, {baseFs = new NodeFS(), create = false, readOnly = false, stats}: Options = {}) {
    super();

    this.path = p;

    this.baseFs = baseFs;

    if (stats) {
      this.stats = stats;
    } else {
      try {
        this.stats = this.baseFs.statSync(p);
      } catch (error) {
        if (error.code === `ENOENT` && create) {
          this.stats = Object.assign(new StatEntry(), {uid: 0, gid: 0, size: 0, blksize: 0, atimeMs: 0, mtimeMs: 0, ctimeMs: 0, birthtimeMs: 0, atime: new Date(0), mtime: new Date(0), ctime: new Date(0), birthtime: new Date(0), mode: S_IFREG | 0o644});
        } else {
          throw error;
        }
      }
    }

    const errPtr = libzip.malloc(4);

    try {
      let flags = 0;

      if (create)
        flags |= libzip.ZIP_CREATE | libzip.ZIP_TRUNCATE;

      if (readOnly)
        flags |= libzip.ZIP_RDONLY;

      this.zip = libzip.open(p, flags, errPtr);

      if (this.zip === 0) {
        const error = libzip.struct.errorS();
        libzip.error.initWithCode(error, libzip.getValue(errPtr, `i32`));

        throw new Error(libzip.error.strerror(error));
      }
    } finally {
      libzip.free(errPtr);
    }

    const entryCount = libzip.getNumEntries(this.zip, 0);

    this.listings.set(`/`, new Set());

    for (let t = 0; t < entryCount; ++t) {
      const raw = libzip.getName(this.zip, t, 0);

      if (posix.isAbsolute(raw))
        continue;

      const p = posix.resolve(`/`, raw);

      this.registerEntry(p, t);
    }

    this.ready = true;
  }

  getRealPath() {
    return this.path;
  }

  saveAndClose() {
    if (!this.ready)
      throw Object.assign(new Error(`EBUSY: archive closed, close`), {code: `EBUSY`});

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
    libzip.discard(this.zip);

    this.ready = false;
  }

  async openPromise(p: string, flags: string, mode?: number) {
    return this.openSync(p, flags, mode);
  }

  openSync(p: string, flags: string, mode?: number): never {
    throw new Error(`Unimplemented`);
  }

  async closePromise(fd: number) {
    this.closeSync(fd);
  }

  closeSync(fd: number): never {
    throw new Error(`Unimplemented`);
  }

  createReadStream(p: string, {encoding}: CreateReadStreamOptions = {}): ReadStream {
    const stream = Object.assign(new PassThrough(), {
      bytesRead: 0,
      path: p,
      close: () => {
        clearImmediate(immediate);
      }
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

  createWriteStream(p: string, {encoding}: CreateWriteStreamOptions = {}): WriteStream {
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

  async realpathPromise(p: string) {
    return this.realpathSync(p);
  }

  realpathSync(p: string): string {
    const resolvedP = this.resolveFilename(`lstat '${p}'`, p);

    if (!this.entries.has(resolvedP) && !this.listings.has(resolvedP))
      throw Object.assign(new Error(`ENOENT: no such file or directory, lstat '${p}'`), {code: `ENOENT`});

    return resolvedP;
  }

  async existsPromise(p: string) {
    return this.existsSync(p);
  }

  existsSync(p: string): boolean {
    let resolvedP;

    try {
      resolvedP = this.resolveFilename(`stat '${p}'`, p);
    } catch (error) {
      return false;
    }

    return this.entries.has(resolvedP) || this.listings.has(resolvedP);
  }

  async statPromise(p: string) {
    return this.statSync(p);
  }

  statSync(p: string) {
    const resolvedP = this.resolveFilename(`stat '${p}'`, p);

    if (!this.entries.has(resolvedP) && !this.listings.has(resolvedP))
      throw Object.assign(new Error(`ENOENT: no such file or directory, stat '${p}'`), {code: `ENOENT`});

    if (p[p.length - 1] === `/` && !this.listings.has(resolvedP))
      throw Object.assign(new Error(`ENOTDIR: not a directory, stat '${p}'`), {code: `ENOTDIR`});

    return this.statImpl(`stat '${p}'`, resolvedP);
  }

  async lstatPromise(p: string) {
    return this.lstatSync(p);
  }

  lstatSync(p: string) {
    const resolvedP = this.resolveFilename(`lstat '${p}'`, p, false);

    if (!this.entries.has(resolvedP) && !this.listings.has(resolvedP))
      throw Object.assign(new Error(`ENOENT: no such file or directory, lstat '${p}'`), {code: `ENOENT`});

    if (p[p.length - 1] === `/` && !this.listings.has(resolvedP))
      throw Object.assign(new Error(`ENOTDIR: not a directory, lstat '${p}'`), {code: `ENOTDIR`});

    return this.statImpl(`lstat '${p}'`, resolvedP);
  }

  private statImpl(reason: string, p: string): Stats {
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

  private registerListing(p: string) {
    let listing = this.listings.get(p);

    if (listing)
      return listing;

    const parentListing = this.registerListing(posix.dirname(p));
    listing = new Set();

    parentListing.add(posix.basename(p));
    this.listings.set(p, listing);

    return listing;
  }

  private registerEntry(p: string, index: number) {
    const parentListing = this.registerListing(posix.dirname(p));
    parentListing.add(posix.basename(p));

    this.entries.set(p, index);
  }

  private resolveFilename(reason: string, p: string, resolveLastComponent: boolean = true) {
    if (!this.ready)
      throw Object.assign(new Error(`EBUSY: archive closed, ${reason}`), {code: `EBUSY`});

    let resolvedP = posix.resolve(`/`, p);

    if (resolvedP === `/`)
      return `/`;

    while (true) {
      const parentP = this.resolveFilename(reason, posix.dirname(resolvedP), true);

      const isDir = this.listings.has(parentP);
      const doesExist = this.entries.has(parentP);

      if (!isDir && !doesExist)
        throw Object.assign(new Error(`ENOENT: no such file or directory, ${reason}`), {code: `ENOENT`});

      if (!isDir)
        throw Object.assign(new Error(`ENOTDIR: not a directory, ${reason}`), {code: `ENOTDIR`});

      resolvedP = posix.resolve(parentP, posix.basename(resolvedP));

      if (!resolveLastComponent)
        break;

      const index = libzip.name.locate(this.zip, resolvedP);
      if (index === -1)
        break;

      if (this.isSymbolicLink(index)) {
        const target = this.getFileSource(index).toString();
        resolvedP = posix.resolve(posix.dirname(resolvedP), target);
      } else {
        break;
      }
    }

    return resolvedP;
  }

  private setFileSource(p: string, content: string | Buffer | ArrayBuffer | DataView) {
    if (!Buffer.isBuffer(content))
      content = Buffer.from(content as any);

    const buffer = libzip.malloc(content.byteLength);

    if (!buffer)
      throw new Error(`Couldn't allocate enough memory`);

    // Copy the file into the Emscripten heap
    const heap = new Uint8Array(libzip.HEAPU8.buffer, buffer, content.byteLength);
    heap.set(content as any);

    const source = libzip.source.fromBuffer(this.zip, buffer, content.byteLength, 0, true);

    if (source === 0) {
      libzip.free(buffer);
      throw new Error(libzip.error.strerror(libzip.getError(this.zip)));
    }

    return libzip.file.add(this.zip, posix.relative(`/`, p), source, libzip.ZIP_FL_OVERWRITE);
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

  async chmodPromise(p: string, mask: number) {
    return this.chmodSync(p, mask);
  }

  chmodSync(p: string, mask: number) {
    const resolvedP = this.resolveFilename(`chmod '${p}'`, p, false);

    if (this.listings.has(resolvedP)) {
      if (mask === 0o755) {
        return;
      } else {
        throw Object.assign(new Error(`EISDIR: illegal operation on a directory, chmod '${p}'`), {code: `EISDIR`});
      }
    }

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

  async renamePromise(oldP: string, newP: string) {
    return this.renameSync(oldP, newP);
  }

  renameSync(oldP: string, newP: string): never {
    throw new Error(`Unimplemented`);
  }

  async copyFilePromise(sourceP: string, destP: string, flags?: number) {
    return this.copyFileSync(sourceP, destP, flags);
  }

  copyFileSync(sourceP: string, destP: string, flags: number = 0) {
    if ((flags & constants.COPYFILE_FICLONE_FORCE) !== 0)
      throw Object.assign(new Error(`ENOSYS: unsupported clone operation, copyfile '${sourceP}' -> ${destP}'`), {code: `ENOSYS`});

    const resolvedSourceP = this.resolveFilename(`copyfile '${sourceP} -> ${destP}'`, sourceP);
    const indexSource = this.entries.get(resolvedSourceP);

    if (typeof indexSource === `undefined`)
      throw Object.assign(new Error(`EINVAL: invalid argument, copyfile '${sourceP}' -> '${destP}'`), {code: `EINVAL`});

    const resolvedDestP = this.resolveFilename(`copyfile '${sourceP}' -> ${destP}'`, destP);
    const indexDest = this.entries.get(resolvedDestP);

    if ((flags & (constants.COPYFILE_EXCL | constants.COPYFILE_FICLONE_FORCE)) !== 0 && typeof indexDest !== `undefined`)
      throw Object.assign(new Error(`EEXIST: file already exists, copyfile '${sourceP}' -> '${destP}'`), {code: `EEXIST`});

    const source = this.getFileSource(indexSource);
    const newIndex = this.setFileSource(resolvedDestP, source);

    if (newIndex !== indexDest) {
      this.registerEntry(resolvedDestP, newIndex);
    }
  }

  async writeFilePromise(p: string, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return this.writeFileSync(p, content, opts);
  }

  writeFileSync(p: string, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    const resolvedP = this.resolveFilename(`open '${p}'`, p);

    if (this.listings.has(resolvedP))
      throw Object.assign(new Error(`EISDIR: illegal operation on a directory, open '${p}'`), {code: `EISDIR`});

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

  async unlinkPromise(p: string) {
    return this.unlinkSync(p);
  }

  unlinkSync(p: string) {
    throw new Error(`Unimplemented`);
  }

  async utimesPromise(p: string, atime: Date | string | number, mtime: Date | string | number) {
    return this.utimesSync(p, atime, mtime);
  }

  utimesSync(p: string, atime: Date | string | number, mtime: Date | string | number) {
    const resolvedP = this.resolveFilename(`chmod '${p}'`, p);

    return this.utimesImpl(resolvedP, mtime);
  }

  async lutimesPromise(p: string, atime: Date | string | number, mtime: Date | string | number) {
    return this.lutimesSync(p, atime, mtime);
  }

  lutimesSync(p: string, atime: Date | string | number, mtime: Date | string | number) {
    const resolvedP = this.resolveFilename(`chmod '${p}'`, p, false);

    return this.utimesImpl(resolvedP, mtime);
  }

  private utimesImpl(resolvedP: string, mtime: Date | string | number) {
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

  async mkdirPromise(p: string) {
    return this.mkdirSync(p);
  }

  mkdirSync(p: string) {
    const resolvedP = this.resolveFilename(`mkdir '${p}'`, p);

    if (this.entries.has(resolvedP) || this.listings.has(resolvedP))
      throw Object.assign(new Error(`EEXIST: file already exists, mkdir '${p}'`), {code: `EEXIST`});

    this.hydrateDirectory(resolvedP);
  }

  async rmdirPromise(p: string) {
    return this.rmdirSync(p);
  }

  rmdirSync(p: string) {
    throw new Error(`Unimplemented`);
  }

  private hydrateDirectory(resolvedP: string) {
    const index = libzip.dir.add(this.zip, posix.relative(`/`, resolvedP));
    if (index === -1)
      throw new Error(libzip.error.strerror(libzip.getError(this.zip)));

    this.registerListing(resolvedP);
    this.registerEntry(resolvedP, index);

    return index;
  }

  async symlinkPromise(target: string, p: string) {
    return this.symlinkSync(target, p);
  }

  symlinkSync(target: string, p: string) {
    const resolvedP = this.resolveFilename(`symlink '${target}' -> '${p}'`, p);

    if (this.listings.has(resolvedP))
      throw Object.assign(new Error(`EISDIR: illegal operation on a directory, symlink '${target}' -> '${p}'`), {code: `EISDIR`});

    if (this.entries.has(resolvedP))
      throw Object.assign(new Error(`EEXIST: file already exists, symlink '${target}' -> '${p}'`), {code: `EEXIST`});

    const index = this.setFileSource(resolvedP, target);

    this.registerEntry(resolvedP, index);

    const rc = libzip.file.setExternalAttributes(this.zip, index, 0, 0, libzip.ZIP_OPSYS_UNIX, (0o120000 | 0o777) << 16);
    if (rc === -1) {
      throw new Error(libzip.error.strerror(libzip.getError(this.zip)));
    }
  }

  readFilePromise(p: string, encoding: 'utf8'): Promise<string>;
  readFilePromise(p: string, encoding?: string): Promise<Buffer>;
  async readFilePromise(p: string, encoding?: string) {
    // This weird switch is required to tell TypeScript that the signatures are proper (otherwise it thinks that only the generic one is covered)
    switch (encoding) {
      case `utf8`:
        return this.readFileSync(p, encoding);
      default:
        return this.readFileSync(p, encoding);
    }
  }

  readFileSync(p: string, encoding: 'utf8'): string;
  readFileSync(p: string, encoding?: string): Buffer;
  readFileSync(p: string, encoding?: string) {
    // This is messed up regarding the TS signatures
    if (typeof encoding === `object`)
      // @ts-ignore
      encoding = encoding ? encoding.encoding : undefined;

    const resolvedP = this.resolveFilename(`open '${p}'`, p);

    if (!this.entries.has(resolvedP) && !this.listings.has(resolvedP))
      throw Object.assign(new Error(`ENOENT: no such file or directory, open '${p}'`), {code: `ENOENT`});

    // Ensures that the last component is a directory, if the user said so (even if it is we'll throw right after with EISDIR anyway)
    if (p[p.length - 1] === `/` && !this.listings.has(resolvedP))
      throw Object.assign(new Error(`ENOTDIR: not a directory, open '${p}'`), {code: `ENOTDIR`});

    if (this.listings.has(resolvedP))
      throw Object.assign(new Error(`EISDIR: illegal operation on a directory, read`), {code: `EISDIR`});

    const entry = this.entries.get(resolvedP);
    if (entry === undefined)
      throw new Error(`Unreachable`);

    const data = this.getFileSource(entry);

    return encoding ? data.toString(encoding) : data;
  }

  async readdirPromise(p: string) {
    return this.readdirSync(p);
  }

  readdirSync(p: string): Array<string> {
    const resolvedP = this.resolveFilename(`scandir '${p}'`, p);

    if (!this.entries.has(resolvedP) && !this.listings.has(resolvedP))
      throw Object.assign(new Error(`ENOENT: no such file or directory, scandir '${p}'`), {code: `ENOENT`});

    const directoryListing = this.listings.get(resolvedP);

    if (!directoryListing)
      throw Object.assign(new Error(`ENOTDIR: not a directory, scandir '${p}'`), {code: `ENOTDIR`});

    return Array.from(directoryListing);
  }

  async readlinkPromise(p: string) {
    return this.readlinkSync(p);
  }

  readlinkSync(p: string): string {
    const resolvedP = this.resolveFilename(`readlink '${p}'`, p, false);

    if (!this.entries.has(resolvedP) && !this.listings.has(resolvedP))
      throw Object.assign(new Error(`ENOENT: no such file or directory, readlink '${p}'`), {code: `ENOENT`});

    // Ensure that the last component is a directory (if it is we'll throw right after with EISDIR anyway)
    if (p[p.length - 1] === `/` && !this.listings.has(resolvedP))
      throw Object.assign(new Error(`ENOTDIR: not a directory, open '${p}'`), {code: `ENOTDIR`});

    if (this.listings.has(resolvedP))
      throw Object.assign(new Error(`EINVAL: invalid argument, readlink '${p}'`), {code: `EINVAL`});

    const entry = this.entries.get(resolvedP);

    if (entry === undefined)
      throw new Error(`Unreachable`);

    const rc = libzip.file.getExternalAttributes(this.zip, entry, 0, 0, libzip.uint08S, libzip.uint32S);
    if (rc === -1)
      throw new Error(libzip.error.strerror(libzip.getError(this.zip)));

    const opsys = libzip.getValue(libzip.uint08S, `i8`) >>> 0;
    if (opsys !== libzip.ZIP_OPSYS_UNIX)
      throw Object.assign(new Error(`EINVAL: invalid argument, readlink '${p}'`), {code: `EINVAL`});

    const attributes = libzip.getValue(libzip.uint32S, `i32`) >>> 16;
    if ((attributes & 0o170000) !== 0o120000)
      throw Object.assign(new Error(`EINVAL: invalid argument, readlink '${p}'`), {code: `EINVAL`});

    return this.getFileSource(entry).toString();
  }
};
