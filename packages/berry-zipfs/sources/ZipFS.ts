// Used for "typeof fs"
import fs = require('fs');

import libzip              from '@berry/libzip';
import {ReadStream, Stats} from 'fs';
import {posix}             from 'path';
import {PassThrough}       from 'stream';

const IS_DIRECTORY_STAT = {
  isBlockDevice: () => false,
  isCharacterDevice: () => false,
  isDirectory: () => true,
  isFIFO: () => false,
  isFile: () => false,
  isSocket: () => false,
  isSymbolicLink: () => false,

  dev: 0,
  ino: 0,
  mode: 755,
  nlink: 1,
  rdev: 0,
  blocks: 1,
};

const IS_FILE_STAT = {
  isBlockDevice: () => false,
  isCharacterDevice: () => false,
  isDirectory: () => false,
  isFIFO: () => false,
  isFile: () => true,
  isSocket: () => false,
  isSymbolicLink: () => false,

  dev: 0,
  ino: 0,
  mode: 644,
  nlink: 1,
  rdev: 0,
  blocks: 1,
};

export type Options = {
  baseFs?: typeof fs,
  create?: boolean,
};

export class ZipFS {
  private readonly path: string;

  private readonly baseFs: typeof fs;

  private readonly stats: Stats;
  private readonly zip: number;

  private readonly listings: Map<string, Set<string>> = new Map();
  private readonly entries: Map<string, number> = new Map();

  public static SUPPORTED = new Set([
    `exists`,
    `realpath`,
    `readdir`,
    `stat`,
    `lstat`,
    `readFile`,
  ]);

  public static SUPPORTED_SYNC_ONLY = new Set([
    `createReadStream`,
  ]);

  constructor(p: string, {baseFs = fs, create = false}: Options = {}) {
    this.path = p;

    this.baseFs = baseFs;

    try {
      this.stats = this.baseFs.statSync(p);
    } catch (error) {
      if (error.code === `ENOENT` && create) {
        this.stats = {... IS_FILE_STAT, uid: 0, gid: 0, size: 0, blksize: 0, atimeMs: 0, mtimeMs: 0, ctimeMs: 0, birthtimeMs: 0, atime: new Date(0), mtime: new Date(0), ctime: new Date(0), birthtime: new Date(0)};
      } else {
        throw error;
      }
    }

    const errPtr = libzip.malloc(4);

    try {
      let flags = 0;

      if (create)
        flags |= libzip.ZIP_CREATE | libzip.ZIP_TRUNCATE;

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
      const p = posix.resolve(`/`, raw);

      this.registerEntry(p, t);
    }
  }

  close(): string {
    const rc = libzip.close(this.zip);

    if (rc !== 0)
      throw new Error(libzip.error.strerror(libzip.getError(this.zip)));
    
    return this.path;
  }

  discard() {
    libzip.discard(this.zip);

    return this.path;
  }

  createReadStream(p: string, {encoding}: {encoding?: string} = {}): ReadStream {
    p = this.realpath(p);

    const data = this.readFile(p, encoding);

    const stream = Object.assign(new PassThrough(), {
      bytesRead: 0,
      path: p,
      close: () => {
        clearImmediate(immediate);
      }
    });

    const immediate = setImmediate(() => {
      stream.bytesRead = data.length;
      stream.write(data);
      stream.end();
    });

    return stream;
  }

  realpath(p: string): string {
    p = posix.resolve(`/`, p);

    if (this.listings.has(p) || this.entries.has(p))
      return p;

    this.ensurePathCorrectness(p, `stat`);
    throw new Error(`Unreachable`);
  }

  readdir(p: string): Array<string> {
    p = this.realpath(p);

    const directoryListing = this.listings.get(p);

    if (!directoryListing) {
      this.ensurePathCorrectness(p, `scandir`, true);
      throw new Error(`Unreachable`);
    }

    return Array.from(directoryListing);
  }

  exists(p: string): boolean {
    const origP = p;
    p = posix.resolve(`/`, p);

    // Only checks in the directory entries
    if (origP[origP.length - 1] === `/`)
      return this.listings.has(p);

    return this.listings.has(p) || this.entries.has(p);
  }

  stat(p: string) {
    const origP = p;
    p = this.realpath(p);

    // Ensures that it's a directory
    if (origP[origP.length - 1] === `/`)
      this.ensurePathCorrectness(p, `stat`, true);

    return this.statImpl(p);
  }

  lstat(p: string) {
    const origP = p;
    p = posix.join(this.realpath(posix.dirname(p)), posix.basename(p));

    // Ensures that it's a directory
    if (origP[origP.length - 1] === `/`)
      this.ensurePathCorrectness(p, `lstat`, true);

    return this.statImpl(p);
  }

  private statImpl(p: string): Stats {
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

      return Object.assign({uid, gid, size, blksize, blocks, atime, birthtime, ctime, mtime, atimeMs, birthtimeMs, ctimeMs, mtimeMs}, IS_DIRECTORY_STAT);
    }

    const entry = this.entries.get(p);

    if (entry !== undefined) {
      const stat = libzip.struct.statS();

      const rc = libzip.statIndex(this.zip, entry, 0, 0, stat);
      if (rc !== 0)
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

      return Object.assign({uid, gid, size, blksize, blocks, atime, birthtime, ctime, mtime, atimeMs, birthtimeMs, ctimeMs, mtimeMs}, IS_FILE_STAT);
    }

    this.ensurePathCorrectness(p, `stat`);
    throw new Error(`Unreachable`);
  }

  mkdir(p: string) {
    p = posix.resolve(`/`, p);

    if (p === `/`)
      return;
    
    const index = libzip.dir.add(this.zip, p.slice(1));

    if (index === -1)
      throw new Error(libzip.error.strerror(libzip.getError(this.zip)));

    this.registerListing(p);
    this.registerEntry(p, index);
  }

  mkdirp(p: string) {
    p = posix.resolve(`/`, p);

    if (p === `/`)
      return;
    
    const parts = p.split(`/`);

    for (let u = 2; u <= parts.length; ++u) {
      this.mkdir(parts.slice(0, u).join(`/`));
    }
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

  writeFile(p: string, content: Buffer | string) {
    p = posix.join(this.realpath(posix.dirname(p)), posix.basename(p));

    if (typeof content === `string`)
      content = Buffer.from(content);

    const buffer = libzip.malloc(content.byteLength);

    if (!buffer)
      throw new Error(`Couldn't allocate enough memory`);

    // Copy the file into the Emscripten heap
    const heap = new Uint8Array(libzip.HEAPU8.buffer, buffer, content.byteLength);
    heap.set(content);

    const source = libzip.source.fromBuffer(this.zip, buffer, content.byteLength, 0, true);

    if (source === 0) {
      libzip.free(buffer);
      throw new Error(libzip.error.strerror(libzip.getError(this.zip)));
    }

    libzip.file.add(this.zip, p, source, libzip.ZIP_FL_OVERWRITE);
  }

  readFile(p: string, encoding?: string) {
    const origP = p;
    p = this.realpath(p);

    // Ensure that the last component is a directory (if it is we'll throw right after with EISDIR anyway)
    if (origP[origP.length - 1] === `/`)
      this.ensurePathCorrectness(p, `open`, true);

    if (this.listings.has(p))
      throw new Error(`EISDIR: illegal operation on a directory, read`);

    const entry = this.entries.get(p);

    if (entry === undefined)
      throw new Error(`Unreachable`);

    const stat = libzip.struct.statS();

    const rc = libzip.statIndex(this.zip, entry, 0, 0, stat);
    if (rc !== 0)
      throw new Error(libzip.error.strerror(libzip.getError(this.zip)));

    const size = libzip.struct.statSize(stat);
    const buffer = libzip.malloc(size);

    try {
      const file = libzip.fopenIndex(this.zip, entry, 0, 0);
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

        return encoding ? data.toString(encoding) : data;
      } finally {
        libzip.fclose(file);
      }
    } finally {
      libzip.free(buffer);
    }
  }

  private ensurePathCorrectness(p: string, op: string, checkDir: boolean = false) {
    const parts = p.split('/');

    // Removes the last component if it's empty ("/", or "/foo/bar/")
    if (!parts[parts.length - 1])
      parts.pop();

    for (let t = 1; t < parts.length; ++t) {
      const parentPath = parts.slice(0, t).join(`/`) || `/`;

      const parentListing = this.listings.get(parentPath);
      if (!parentListing)
        throw Object.assign(new Error(`ENOTDIR: not a directory, ${op} '${parentPath}'`), {code: `ENOTDIR`});

      if (!parentListing.has(parts[t])) {
        throw Object.assign(new Error(`ENOENT: no such file or directory, ${op} '${posix.join(parentPath, parts[t])}'`), {code: `ENOENT`});
      }
    }

    if (checkDir && !this.listings.get(p)) {
      throw Object.assign(new Error(`ENOTDIR: not a directory, ${op} '${p}'`), {code: `ENOTDIR`});
    }
  }
};
