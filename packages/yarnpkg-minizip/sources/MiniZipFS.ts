import { Dirent, DirentNoPath, ReaddirOptions } from '@yarnpkg/fslib';
import { WatchOptions, WatchCallback, Watcher, Dir, Stats, BigIntStats, StatSyncOptions, StatOptions } from '@yarnpkg/fslib';
import { FakeFS, MkdirOptions, RmdirOptions, RmOptions, WriteFileOptions, OpendirOptions } from '@yarnpkg/fslib';
import { CreateReadStreamOptions, CreateWriteStreamOptions, BasePortableFakeFS, ExtractHintOptions, WatchFileCallback, WatchFileOptions, StatWatcher } from '@yarnpkg/fslib';
import { NodeFS } from '@yarnpkg/fslib';
import { opendir } from '@yarnpkg/fslib';
import { watchFile, unwatchFile, unwatchAllFiles } from '@yarnpkg/fslib';
import { errors, statUtils } from '@yarnpkg/fslib';
import { FSPath, PortablePath, ppath, Filename } from '@yarnpkg/fslib';
import { ReadStream, WriteStream, constants } from 'fs';
import { PassThrough } from 'stream';
import zlib from 'zlib';

// todo 
// native nodefs is faster??

const UNIX = 3

export type ZipPathOptions = {
  baseFs?: FakeFS<PortablePath>;

};

export interface Entry {
  name: string;
  compressionMethod: number;
  size: number;
  os: number;
  isSymbolicLink: boolean;
  crc: number //needed?
  compressedSize: number;
  externalAttributes: number;
  mTime: number
  fileContentOffset: number;
  index: number;
}


const SIGNATURE = {
  CENTRAL_DIRECTORY: 0x02014b50,
  END_OF_CENTRAL_DIRECTORY: 0x06054b50,
};

const noCommentCDSize = 22;

// const error = () => { throw new Error('not supported algo'); };

// type Decompress = (buf: Buffer) => Buffer;

// const COMPRESSION_METHODS: Record<number, null | Decompress> = {
//   0: null, // 'STORED'
//   1: error, // 'SHRUNK'
//   // 8: null,
//   8: buf => zlib.inflateRawSync(buf), // 'DEFLATED'
//   9: error, // 'DEFLATE64'
//   12: error, // 'BZIP2'
//   14: error, // 'LZMA'
//   19: error, // 'LZ77'
//   93: error, // 'ZSTD'
//   97: error, // 'XZ
// };



// function readFile(baseFs: BasePortableFakeFS, fd: number, entry: Entry) {
//   const contentBuffer = Buffer.alloc(entry.compressedSize);
//   baseFs.readSync(fd, contentBuffer, 0, entry.compressedSize, entry.fileContentOffset);
//   const decompress = COMPRESSION_METHODS[entry.compressionMethod];
//   if (decompress === null) {
//     return contentBuffer;
//   }
//   return decompress(contentBuffer);
// }

function readZipSync(baseFs: BasePortableFakeFS, fd: number): Entry[] {
  
    const stats = baseFs.fstatSync(fd);
    const fileSize = stats.size;

    if (fileSize < noCommentCDSize) {
      throw new Error('Invalid ZIP file: EOCD not found');
    }

    let eocdOffset = -1;

    // fast read if no comment
    let cdBuffer = Buffer.alloc(noCommentCDSize);
    baseFs.readSync(
      fd,
      cdBuffer,
      0,
      noCommentCDSize,
      fileSize - noCommentCDSize
    );

    if (cdBuffer.readUInt32LE(0) === SIGNATURE.END_OF_CENTRAL_DIRECTORY) {
      eocdOffset = 0
    } else {
      const bufferSize = Math.min(65557, fileSize);
      cdBuffer = Buffer.alloc(bufferSize);

      // Read potential EOCD area
      baseFs.readSync(
        fd,
        cdBuffer,
        0,
        bufferSize,
        Math.max(0, fileSize - bufferSize)
      );

      // Find EOCD signature
      for (let i = cdBuffer.length - 4; i >= 0; i--) {
        if (cdBuffer.readUInt32LE(i) === SIGNATURE.END_OF_CENTRAL_DIRECTORY) {
          eocdOffset = i;
          break;
        }
      }
      if (eocdOffset === -1) throw new Error('Invalid ZIP file: EOCD not found');
    }



    const totalEntries = cdBuffer.readUInt16LE(eocdOffset + 10);
    const centralDirSize = cdBuffer.readUInt32LE(eocdOffset + 12);
    const centralDirOffset = cdBuffer.readUInt32LE(eocdOffset + 16);

    // Read central directory
    const centralDirBuffer = Buffer.alloc(centralDirSize);
    baseFs.readSync(fd, centralDirBuffer, 0, centralDirBuffer.length, centralDirOffset);

    const entries: Entry[] = [];
    let offset = 0;
    let index = 0
    while (offset < centralDirBuffer.length && index < totalEntries) { // rm offset < centralDirBuffer.length?
      if (centralDirBuffer.readUInt32LE(offset) !== SIGNATURE.CENTRAL_DIRECTORY) break;
      const versionMadeBy = centralDirBuffer.readUInt16LE(offset + 4);
      const os = versionMadeBy >>> 8;
      const compressionMethod = centralDirBuffer.readUInt16LE(offset + 10);
      const crc = centralDirBuffer.readUInt32LE(offset + 16);
      const nameLength = centralDirBuffer.readUInt16LE(offset + 28);
      const extraLength = centralDirBuffer.readUInt16LE(offset + 30);
      const commentLength = centralDirBuffer.readUInt16LE(offset + 32);
      const localHeaderOffset = centralDirBuffer.readUInt32LE(offset + 42);
      const name = centralDirBuffer.toString('utf8', offset + 46, offset + 46 + nameLength);
      const fileContentOffset = localHeaderOffset + 30 + nameLength + extraLength
      const externalAttributes = centralDirBuffer.readUInt32LE(offset + 38);

      entries.push({
        index,
        name,
        os,
        mTime: 0, //we dont care,
        crc, //needed?
        compressionMethod,
        isSymbolicLink: os === UNIX && ((externalAttributes >>> 16) & constants.S_IFMT) === constants.S_IFLNK,
        size: centralDirBuffer.readUInt32LE(offset + 24),
        compressedSize: centralDirBuffer.readUInt32LE(offset + 20),
        externalAttributes,
        fileContentOffset,
      });

      index += 1
      offset += 46 + nameLength + extraLength + commentLength;
    }

  return entries;

}



export class MiniZipFS extends BasePortableFakeFS {


  private readonly baseFs!: FakeFS<PortablePath>
  private readonly path: PortablePath | null;

  private readonly stats: Stats;

  private readonly listings: Map<PortablePath, Set<Filename>> = new Map();
  private readonly entries: Map<PortablePath, Entry> = new Map();

  /**
   * A cache of indices mapped to file sources.
   * Populated by `setFileSource` calls.
   * Required for supporting read after write.
   */
  // private readonly fileSources: Map<number, Buffer> = new Map();

  private readonly fds: Map<number, { cursor: number, p: PortablePath }> = new Map();
  private nextFd: number = 0;
  private archiveFd: number;
  private hasSymlinks: boolean;


  constructor(p: PortablePath, opts: ZipPathOptions = {}) {
    super();
    const { baseFs = new NodeFS() } = opts;
    this.baseFs = baseFs;
    this.path = p;

    this.stats = this.baseFs!.statSync(p);

    this.listings.set(PortablePath.root, new Set<Filename>());

    this.archiveFd = baseFs.openSync(p, 'r');
    this.hasSymlinks = false
    for (const entry of readZipSync(this.baseFs, this.archiveFd)) {
      const raw = entry.name as PortablePath;
      if (ppath.isAbsolute(raw))
        continue;

      const p = ppath.resolve(PortablePath.root, raw);
      this.registerEntry(p, entry);
      if (entry.isSymbolicLink)  {
        this.hasSymlinks = true
      }

      // If the raw path is a directory, register it
      // to prevent empty folder being skipped
      if (raw.endsWith(`/`)) {
        this.registerListing(p);
      }
    }
  }

  saveAndClose() {
    this.clean()
  }
  discardAndClose() {
    this.clean()
  }
  private clean() {
    unwatchAllFiles(this);
    this.baseFs.closeSync(this.archiveFd);
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

  getRealPath() {
    if (!this.path)
      throw new Error(`ZipFS don't have real paths when loaded from a buffer`);

    return this.path;
  }

  resolve(p: PortablePath) {
    return ppath.resolve(PortablePath.root, p);
  }

  async openPromise(p: PortablePath, flags: string, mode?: number) {
    return this.openSync(p, flags, mode);
  }

  openSync(p: PortablePath, flags: string, mode?: number) {
    const fd = this.nextFd++;
    this.fds.set(fd, { cursor: 0, p });
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

    return opendir(this, resolvedP, entries, { onClose });
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

  createReadStream(p: PortablePath | null, { encoding }: CreateReadStreamOptions = {}): ReadStream {
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

  createWriteStream(p: PortablePath | null, { encoding }: CreateWriteStreamOptions = {}): WriteStream {
    throw errors.EROFS(`open '${p}'`);
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

    if (!this.hasSymlinks) {
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

    if (mode & constants.W_OK) {
      throw errors.EROFS(`access '${p}'`);
    }
  }

  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/51d793492d4c2e372b01257668dcd3afc58d7352/types/node/v16/fs.d.ts#L1042-L1059
  async statPromise(p: PortablePath): Promise<Stats>;
  async statPromise(p: PortablePath, opts: (StatOptions & { bigint?: false | undefined }) | undefined): Promise<Stats>;
  async statPromise(p: PortablePath, opts: StatOptions & { bigint: true }): Promise<BigIntStats>;
  async statPromise(p: PortablePath, opts?: StatOptions): Promise<Stats | BigIntStats>;
  async statPromise(p: PortablePath, opts: StatOptions = { bigint: false }): Promise<Stats | BigIntStats> {
    if (opts.bigint)
      return this.statSync(p, { bigint: true });

    return this.statSync(p);
  }

  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/51d793492d4c2e372b01257668dcd3afc58d7352/types/node/v16/fs.d.ts#L931-L967
  statSync(p: PortablePath): Stats;
  statSync(p: PortablePath, opts?: StatSyncOptions & { bigint?: false | undefined, throwIfNoEntry: false }): Stats | undefined;
  statSync(p: PortablePath, opts: StatSyncOptions & { bigint: true, throwIfNoEntry: false }): BigIntStats | undefined;
  statSync(p: PortablePath, opts?: StatSyncOptions & { bigint?: false | undefined }): Stats;
  statSync(p: PortablePath, opts: StatSyncOptions & { bigint: true }): BigIntStats;
  statSync(p: PortablePath, opts: StatSyncOptions & { bigint: boolean, throwIfNoEntry?: false | undefined }): Stats | BigIntStats;
  statSync(p: PortablePath, opts?: StatSyncOptions): Stats | BigIntStats | undefined;
  statSync(p: PortablePath, opts: StatSyncOptions = { bigint: false, throwIfNoEntry: true }): Stats | BigIntStats | undefined {
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

  async fstatPromise(fd: number): Promise<Stats>;
  async fstatPromise(fd: number, opts: { bigint: true }): Promise<BigIntStats>;
  async fstatPromise(fd: number, opts?: { bigint: boolean }): Promise<BigIntStats | Stats>;
  async fstatPromise(fd: number, opts?: { bigint: boolean }) {
    return this.fstatSync(fd, opts);
  }

  fstatSync(fd: number): Stats;
  fstatSync(fd: number, opts: { bigint: true }): BigIntStats;
  fstatSync(fd: number, opts?: { bigint: boolean }): BigIntStats | Stats;
  fstatSync(fd: number, opts?: { bigint: boolean }) {
    const entry = this.fds.get(fd);
    if (typeof entry === `undefined`)
      throw errors.EBADF(`fstatSync`);

    const { p } = entry;

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
  async lstatPromise(p: PortablePath, opts: StatOptions = { bigint: false }): Promise<Stats | BigIntStats> {
    if (opts.bigint)
      return this.lstatSync(p, { bigint: true });

    return this.lstatSync(p);
  }

  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/51d793492d4c2e372b01257668dcd3afc58d7352/types/node/v16/fs.d.ts#L931-L967
  lstatSync(p: PortablePath): Stats;
  lstatSync(p: PortablePath, opts?: StatSyncOptions & { bigint?: false | undefined, throwIfNoEntry: false }): Stats | undefined;
  lstatSync(p: PortablePath, opts: StatSyncOptions & { bigint: true, throwIfNoEntry: false }): BigIntStats | undefined;
  lstatSync(p: PortablePath, opts?: StatSyncOptions & { bigint?: false | undefined }): Stats;
  lstatSync(p: PortablePath, opts: StatSyncOptions & { bigint: true }): BigIntStats;
  lstatSync(p: PortablePath, opts: StatSyncOptions & { bigint: boolean, throwIfNoEntry?: false | undefined }): Stats | BigIntStats;
  lstatSync(p: PortablePath, opts?: StatSyncOptions): Stats | BigIntStats | undefined;
  lstatSync(p: PortablePath, opts: StatSyncOptions = { bigint: false, throwIfNoEntry: true }): Stats | BigIntStats | undefined {
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

  private statImpl(reason: string, p: PortablePath, opts: { bigint: true }): BigIntStats;
  private statImpl(reason: string, p: PortablePath, opts?: { bigint?: false }): Stats;
  private statImpl(reason: string, p: PortablePath, opts?: { bigint?: boolean }): Stats | BigIntStats;
  private statImpl(reason: string, p: PortablePath, opts: { bigint?: boolean } = {}): Stats | BigIntStats {
    const entry = this.entries.get(p);

    // File, or explicit directory
    if (typeof entry !== `undefined`) {

      const uid = this.stats.uid;
      const gid = this.stats.gid;

      const size = (entry.size >>> 0);
      const blksize = 512;
      const blocks = Math.ceil(size / blksize);

      const mtimeMs = (entry.mTime >>> 0) * 1000;
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
      const crc = entry.crc

      const statInstance = Object.assign(new statUtils.StatEntry(), { uid, gid, size, blksize, blocks, atime, birthtime, ctime, mtime, atimeMs, birthtimeMs, ctimeMs, mtimeMs, mode, crc });
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

      const statInstance = Object.assign(new statUtils.StatEntry(), { uid, gid, size, blksize, blocks, atime, birthtime, ctime, mtime, atimeMs, birthtimeMs, ctimeMs, mtimeMs, mode, crc });
      return opts.bigint === true ? statUtils.convertToBigIntStats(statInstance) : statInstance;
    }

    throw new Error(`Unreachable`);
  }

  private getUnixMode(entry: Entry , defaultMode: number) {
    // const rc = this.libzip.file.getExternalAttributes(this.zip, index, 0, 0, this.libzip.uint08S, this.libzip.uint32S);

    if (entry.os !== UNIX)
      return defaultMode;

    return entry.externalAttributes >>> 16;
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

  private registerEntry(p: PortablePath, entry: Entry) {
    const parentListing = this.registerListing(ppath.dirname(p));
    parentListing.add(ppath.basename(p));

    this.entries.set(p, entry);
  }




  private resolveFilename(reason: string, p: PortablePath, resolveLastComponent?: boolean): PortablePath;
  private resolveFilename(reason: string, p: PortablePath, resolveLastComponent: boolean | undefined, throwIfNoEntry: boolean | undefined): PortablePath | undefined;
  private resolveFilename(reason: string, p: PortablePath, resolveLastComponent: boolean = true, throwIfNoEntry = true): PortablePath | undefined {
    let resolvedP = ppath.resolve(PortablePath.root, p);
    if (resolvedP === `/`)
      return PortablePath.root;

    const entry = this.entries.get(resolvedP);
    if (resolveLastComponent && entry !== undefined) {
      if (this.hasSymlinks && this.isSymbolicLink(entry)) {
        const target = this.getFileSource(entry).toString() as PortablePath;
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
      if (!resolveLastComponent || !this.hasSymlinks)
        break;

      const index = this.libzip.name.locate(this.zip, resolvedP.slice(1), 0);
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



  private isSymbolicLink(entry: Entry) {
    return entry.isSymbolicLink
  }

  private getFileSource(entry: Entry): Buffer;
  private getFileSource(entry: Entry, opts: { asyncDecompress: false }): Buffer;
  private getFileSource(entry: Entry, opts: { asyncDecompress: true }): Promise<Buffer>;
  private getFileSource(entry: Entry, opts: { asyncDecompress: boolean }): Promise<Buffer> | Buffer;
  private getFileSource(entry: Entry, opts: { asyncDecompress: boolean } = { asyncDecompress: false }): Promise<Buffer> | Buffer {
    // const { index } = entry;
    // const cachedFileSource = this.fileSources.get(index); //fileSourceCache??
    // if (typeof cachedFileSource !== `undefined`)
    //   return cachedFileSource;


    const data = Buffer.alloc(entry.compressedSize);
    this.baseFs.readSync(this.archiveFd, data, 0, entry.compressedSize, entry.fileContentOffset);

    if (entry.compressionMethod === 0) {
      // this.fileSources.set(index, data);
      return data;
    } else if (opts.asyncDecompress) {
      return new Promise((resolve, reject) => {
        zlib.inflateRaw(data, (error, result) => {
          if (error) {
            reject(error);
          } else {
            // this.fileSources.set(index, result);
            resolve(result);
          }
        });
      });
    } else {
      const decompressedData = zlib.inflateRawSync(data);
      // this.fileSources.set(index, decompressedData);
      return decompressedData;
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
    throw errors.EROFS(`chmod '${p}'`);
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
    throw errors.EROFS(`copyfile '${sourceP} -> '${destP}'`);

  }

  copyFileSync(sourceP: PortablePath, destP: PortablePath, flags: number = 0) {
    throw errors.EROFS(`copyfile '${sourceP} -> '${destP}'`);

  }


  async appendFilePromise(p: FSPath<PortablePath>, content: string | Uint8Array, opts?: WriteFileOptions) {
    throw errors.EROFS(`open '${p}'`);
  }

  appendFileSync(p: FSPath<PortablePath>, content: string | Uint8Array, opts: WriteFileOptions = {}) {
    throw errors.EROFS(`open '${p}'`);
  }

  private fdToPath(fd: number, reason: string) {
    const path = this.fds.get(fd)?.p;
    if (typeof path === `undefined`)
      throw errors.EBADF(reason);

    return path;
  }

  async writeFilePromise(p: FSPath<PortablePath>, content: string | NodeJS.ArrayBufferView, opts?: WriteFileOptions) {
    throw errors.EROFS(`open '${p}'`);
  }

  writeFileSync(p: FSPath<PortablePath>, content: string | NodeJS.ArrayBufferView, opts?: WriteFileOptions) {
    throw errors.EROFS(`open '${p}'`);
  }


  async unlinkPromise(p: PortablePath) {
    return this.unlinkSync(p);
  }

  unlinkSync(p: PortablePath) {
    throw errors.EROFS(`unlink '${p}'`);
  }

  async utimesPromise(p: PortablePath, atime: Date | string | number, mtime: Date | string | number) {
    return this.utimesSync(p, atime, mtime);
  }

  utimesSync(p: PortablePath, atime: Date | string | number, mtime: Date | string | number) {
    throw errors.EROFS(`utimes '${p}'`);
  }

  async lutimesPromise(p: PortablePath, atime: Date | string | number, mtime: Date | string | number) {
    return this.lutimesSync(p, atime, mtime);
  }

  lutimesSync(p: PortablePath, atime: Date | string | number, mtime: Date | string | number) {
    throw errors.EROFS(`lutimes '${p}'`);
  }


  async mkdirPromise(p: PortablePath, opts?: MkdirOptions) {
    return this.mkdirSync(p, opts);
  }

  mkdirSync(p: PortablePath, { mode = 0o755, recursive = false }: MkdirOptions = {}) {
    throw errors.EROFS(`mkdir '${p}'`);
    return undefined;
  }

  async rmdirPromise(p: PortablePath, opts?: RmdirOptions) {
    return this.rmdirSync(p, opts);
  }

  rmdirSync(p: PortablePath, { recursive = false }: RmdirOptions = {}) {
    throw errors.EROFS(`rmdir '${p}'`);
  }
  async rmPromise(p: PortablePath, opts?: RmOptions) {
    return this.rmSync(p, opts);
  }

  rmSync(p: PortablePath, { recursive = false }: RmOptions = {}) {
    throw errors.EROFS(`rm '${p}'`);

  }


  async linkPromise(existingP: PortablePath, newP: PortablePath) {
    return this.linkSync(existingP, newP);
  }

  linkSync(existingP: PortablePath, newP: PortablePath) {
    throw errors.EROFS(`link '${existingP}' -> '${newP}'`);
  }

  async symlinkPromise(target: PortablePath, p: PortablePath) {
    return this.symlinkSync(target, p);
  }

  symlinkSync(target: PortablePath, p: PortablePath) {
    throw errors.EROFS(`symlink '${target}' -> '${p}'`);
  }

  readFilePromise(p: FSPath<PortablePath>, encoding?: null): Promise<Buffer>;
  readFilePromise(p: FSPath<PortablePath>, encoding: BufferEncoding): Promise<string>;
  readFilePromise(p: FSPath<PortablePath>, encoding?: BufferEncoding | null): Promise<Buffer | string>;
  async readFilePromise(p: FSPath<PortablePath>, encoding?: BufferEncoding | null) {
    // This is messed up regarding the TS signatures
    if (typeof encoding === `object`)
      // @ts-expect-error
      encoding = encoding ? encoding.encoding : undefined;

    const data = await this.readFileBuffer(p, { asyncDecompress: true });
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

  private readFileBuffer(p: FSPath<PortablePath>): Buffer;
  private readFileBuffer(p: FSPath<PortablePath>, opts: { asyncDecompress: false }): Buffer;
  private readFileBuffer(p: FSPath<PortablePath>, opts: { asyncDecompress: true }): Promise<Buffer>;
  private readFileBuffer(p: FSPath<PortablePath>, opts: { asyncDecompress: boolean }): Promise<Buffer> | Buffer;
  private readFileBuffer(p: FSPath<PortablePath>, opts: { asyncDecompress: boolean } = { asyncDecompress: false }): Buffer | Promise<Buffer> {
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

  async readdirPromise(p: PortablePath, opts?: null): Promise<Array<Filename>>;
  async readdirPromise(p: PortablePath, opts: { recursive?: false, withFileTypes: true }): Promise<Array<DirentNoPath>>;
  async readdirPromise(p: PortablePath, opts: { recursive?: false, withFileTypes?: false }): Promise<Array<Filename>>;
  async readdirPromise(p: PortablePath, opts: { recursive?: false, withFileTypes: boolean }): Promise<Array<DirentNoPath | Filename>>;
  async readdirPromise(p: PortablePath, opts: { recursive: true, withFileTypes: true }): Promise<Array<Dirent<PortablePath>>>;
  async readdirPromise(p: PortablePath, opts: { recursive: true, withFileTypes?: false }): Promise<Array<PortablePath>>;
  async readdirPromise(p: PortablePath, opts: { recursive: true, withFileTypes: boolean }): Promise<Array<Dirent<PortablePath> | PortablePath>>;
  async readdirPromise(p: PortablePath, opts: { recursive: boolean, withFileTypes: true }): Promise<Array<Dirent<PortablePath> | DirentNoPath>>;
  async readdirPromise(p: PortablePath, opts: { recursive: boolean, withFileTypes?: false }): Promise<Array<PortablePath>>;
  async readdirPromise(p: PortablePath, opts: { recursive: boolean, withFileTypes: boolean }): Promise<Array<Dirent<PortablePath> | DirentNoPath | PortablePath>>;
  async readdirPromise(p: PortablePath, opts?: ReaddirOptions | null): Promise<Array<Dirent<PortablePath> | DirentNoPath | PortablePath>> {
    return this.readdirSync(p, opts as any);
  }

  readdirSync(p: PortablePath, opts?: null): Array<Filename>;
  readdirSync(p: PortablePath, opts: { recursive?: false, withFileTypes: true }): Array<DirentNoPath>;
  readdirSync(p: PortablePath, opts: { recursive?: false, withFileTypes?: false }): Array<Filename>;
  readdirSync(p: PortablePath, opts: { recursive?: false, withFileTypes: boolean }): Array<DirentNoPath | Filename>;
  readdirSync(p: PortablePath, opts: { recursive: true, withFileTypes: true }): Array<Dirent<PortablePath>>;
  readdirSync(p: PortablePath, opts: { recursive: true, withFileTypes?: false }): Array<PortablePath>;
  readdirSync(p: PortablePath, opts: { recursive: true, withFileTypes: boolean }): Array<Dirent<PortablePath> | PortablePath>;
  readdirSync(p: PortablePath, opts: { recursive: boolean, withFileTypes: true }): Array<Dirent<PortablePath> | DirentNoPath>;
  readdirSync(p: PortablePath, opts: { recursive: boolean, withFileTypes?: false }): Array<PortablePath>;
  readdirSync(p: PortablePath, opts: { recursive: boolean, withFileTypes: boolean }): Array<Dirent<PortablePath> | DirentNoPath | PortablePath>;
  readdirSync(p: PortablePath, opts?: ReaddirOptions | null): Array<Dirent<PortablePath> | DirentNoPath | PortablePath> {
    const resolvedP = this.resolveFilename(`scandir '${p}'`, p);
    if (!this.entries.has(resolvedP) && !this.listings.has(resolvedP))
      throw errors.ENOENT(`scandir '${p}'`);

    const directoryListing = this.listings.get(resolvedP);
    if (!directoryListing)
      throw errors.ENOTDIR(`scandir '${p}'`);

    if (opts?.recursive) {
      if (opts?.withFileTypes) {
        const entries = Array.from(directoryListing, name => {
          return Object.assign(this.statImpl(`lstat`, ppath.join(p, name)), {
            name,
            path: PortablePath.dot,
          });
        });

        for (const entry of entries) {
          if (!entry.isDirectory())
            continue;

          const subPath = ppath.join(entry.path, entry.name);
          const subListing = this.listings.get(ppath.join(resolvedP, subPath))!;

          for (const child of subListing) {
            entries.push(Object.assign(this.statImpl(`lstat`, ppath.join(p, subPath, child)), {
              name: child,
              path: subPath,
            }));
          }
        }

        return entries;
      } else {
        const entries: Array<PortablePath> = [...directoryListing];

        for (const subPath of entries) {
          const subListing = this.listings.get(ppath.join(resolvedP, subPath));
          if (typeof subListing === `undefined`)
            continue;

          for (const child of subListing) {
            entries.push(ppath.join(subPath, child));
          }
        }

        return entries;
      }
    } else if (opts?.withFileTypes) {
      return Array.from(directoryListing, name => {
        return Object.assign(this.statImpl(`lstat`, ppath.join(p, name)), {
          name,
          path: undefined,
        });
      });
    } else {
      return [...directoryListing];
    }
  }

  async readlinkPromise(p: PortablePath) {
    const entry = this.prepareReadlink(p);
    return (await this.getFileSource(entry, { asyncDecompress: true })).toString() as PortablePath;
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

    const source = await this.getFileSource(index, { asyncDecompress: true });

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
        ({ persistent = true } = a);
      } break;
    }

    if (!persistent)
      return { on: () => { }, close: () => { } };

    const interval = setInterval(() => { }, 24 * 60 * 60 * 1000);
    return {
      on: () => { }, close: () => {
        clearInterval(interval);
      }
    };
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
