import {PortablePath, constants}                                               from '@yarnpkg/fslib';

import {Stat, ZIP_UNIX, type CompressionData, type ZipImpl, type ZipImplInput} from './ZipFS';

const SIGNATURE = {
  CENTRAL_DIRECTORY: 0x02014b50,
  END_OF_CENTRAL_DIRECTORY: 0x06054b50,
};

const noCommentCDSize = 22;

export interface Entry {
  name: string;
  compressionMethod: number;
  size: number;
  os: number;
  isSymbolicLink: boolean;
  crc: number;
  compressedSize: number;
  externalAttributes: number;
  mtime: number;
  localHeaderOffset: number;
}

export class JsZipImpl implements ZipImpl {
  private data: Buffer;
  private entries: Array<Entry>;
  public filesShouldBeCached = false;

  constructor(opts: ZipImplInput) {
    if (!opts.readOnly)
      throw new Error(`Writable zip archives are not supported`);

    // The whole archive is read into a single buffer up front and all entries
    // are served as slices of it. This matches the libzip reader's I/O pattern
    // (one read per archive instead of a syscall per file) while keeping the
    // data in the Node heap rather than the fixed-size libzip WASM heap.
    if (`buffer` in opts) {
      this.data = Buffer.isBuffer(opts.buffer) ? opts.buffer : Buffer.from(opts.buffer as any);
    } else {
      const fd = opts.baseFs.openSync(opts.path, `r`);
      try {
        const data = Buffer.allocUnsafe(opts.size);
        let read = 0;
        while (read < opts.size) {
          const bytes = opts.baseFs.readSync(fd, data, read, opts.size - read, read);
          if (bytes === 0)
            break;
          read += bytes;
        }
        if (read !== opts.size)
          throw new Error(`Incomplete read`);

        this.data = data;
      } finally {
        opts.baseFs.closeSync(fd);
      }
    }

    this.entries = JsZipImpl.readZipSync(this.data);
  }

  static readZipSync(data: Buffer): Array<Entry> {
    const fileSize = data.length;

    if (fileSize < noCommentCDSize)
      throw new Error(`Invalid ZIP file: EOCD not found`);

    let eocdOffset = -1;

    // fast read if no comment
    let eocdBuffer = data.subarray(fileSize - noCommentCDSize);

    if (eocdBuffer.readUInt32LE(0) === SIGNATURE.END_OF_CENTRAL_DIRECTORY) {
      eocdOffset = 0;
    } else {
      const bufferSize = Math.min(65557, fileSize);
      eocdBuffer = data.subarray(fileSize - bufferSize);

      // Find EOCD signature
      for (let i = eocdBuffer.length - 4; i >= 0; i--) {
        if (eocdBuffer.readUInt32LE(i) === SIGNATURE.END_OF_CENTRAL_DIRECTORY) {
          eocdOffset = i;
          break;
        }
      }

      if (eocdOffset === -1) {
        throw new Error(`Not a zip archive`);
      }
    }

    const totalEntries = eocdBuffer.readUInt16LE(eocdOffset + 10);
    const centralDirSize = eocdBuffer.readUInt32LE(eocdOffset + 12);
    const centralDirOffset = eocdBuffer.readUInt32LE(eocdOffset + 16);
    const commentLength = eocdBuffer.readUInt16LE(eocdOffset + 20);

    // Optional check, fixes two tests: libzip/incons-archive-comment-longer.zip and go/comment-truncated.zip
    // https://github.com/golang/go/blob/f062d7b10b276c1b698819f492e4b4754e160ee3/src/archive/zip/reader_test.go#L573
    // Important to NOT skip last EOCDR. Both using last EOCDR or throwing error is fine, we throw
    if (eocdOffset + commentLength + noCommentCDSize > eocdBuffer.length)
      throw new Error(`Zip archive inconsistent`);

    if (totalEntries == 0xffff || centralDirSize == 0xffffffff || centralDirOffset == 0xffffffff)
      // strictly speaking, not correct, should find zip64 signatures. But chances are 0 for false positives.
      throw new Error(`Zip 64 is not supported`);

    if (centralDirSize > fileSize)
      throw new Error(`Zip archive inconsistent`);

    if (totalEntries > centralDirSize / 46)
      throw new Error(`Zip archive inconsistent`);

    // Read central directory
    if (centralDirOffset + centralDirSize > fileSize)
      throw new Error(`Zip archive inconsistent`);

    const cdBuffer = data.subarray(centralDirOffset, centralDirOffset + centralDirSize);

    const entries: Array<Entry> = [];

    let offset = 0;
    let index = 0;
    let sumCompressedSize = 0;

    while (index < totalEntries) {
      if (offset + 46 > cdBuffer.length)
        throw new Error(`Zip archive inconsistent`);

      if (cdBuffer.readUInt32LE(offset) !== SIGNATURE.CENTRAL_DIRECTORY)
        throw new Error(`Zip archive inconsistent`);

      const versionMadeBy = cdBuffer.readUInt16LE(offset + 4);
      const os = versionMadeBy >>> 8;

      const flags = cdBuffer.readUInt16LE(offset + 8);
      if ((flags  & 0x0001)  !== 0)
        throw new Error(`Encrypted zip files are not supported`);

      // we don't care about data descriptor because we dont read size and crc from local file header
      // const hasDataDescriptor = (flags & 0x8) !== 0;
      const compressionMethod = cdBuffer.readUInt16LE(offset + 10);
      const crc = cdBuffer.readUInt32LE(offset + 16);
      const nameLength = cdBuffer.readUInt16LE(offset + 28);
      const extraLength = cdBuffer.readUInt16LE(offset + 30);
      const commentLength = cdBuffer.readUInt16LE(offset + 32);
      const localHeaderOffset = cdBuffer.readUInt32LE(offset + 42);

      const name = cdBuffer.toString(`utf8`, offset + 46, offset + 46 + nameLength).replaceAll(`\0`, ` `);
      if (name.includes(`\0`))
        throw new Error(`Invalid ZIP file`);

      const compressedSize = cdBuffer.readUInt32LE(offset + 20);
      const externalAttributes = cdBuffer.readUInt32LE(offset + 38);

      entries.push({
        name,
        os,
        mtime: constants.SAFE_TIME, //we dont care,
        crc,
        compressionMethod,
        isSymbolicLink: os === ZIP_UNIX && ((externalAttributes >>> 16) & constants.S_IFMT) === constants.S_IFLNK,
        size: cdBuffer.readUInt32LE(offset + 24),
        compressedSize,
        externalAttributes,
        localHeaderOffset,
      });

      sumCompressedSize += compressedSize;

      index += 1;
      offset += 46 + nameLength + extraLength + commentLength;
    }

    // fast check for archive bombs
    if (sumCompressedSize > fileSize)
      throw new Error(`Zip archive inconsistent`);

    if (offset !== cdBuffer.length)
      throw new Error(`Zip archive inconsistent`);

    return entries;
  }

  getExternalAttributes(index: number): [opsys: number, attributes: number] {
    const entry = this.entries[index];
    return [entry.os, entry.externalAttributes];
  }

  getListings(): Array<string> {
    return this.entries.map(e => e.name);
  }

  getSymlinkCount(): number {
    let count = 0;

    for (const entry of this.entries)
      if (entry.isSymbolicLink)
        count += 1;

    return count;
  }

  stat(index: number): Stat {
    const entry = this.entries[index];

    return {
      crc: entry.crc,
      mtime: entry.mtime,
      size: entry.size,
    };
  }

  locate(name: string): number {
    // https://github.com/nih-at/libzip/blob/f7f725d432db2dd1b266d336a3dccc693d988447/lib/zip_name_locate.c#L50
    for (let ind = 0; ind < this.entries.length; ind++)
      if (this.entries[ind].name === name)
        return ind;

    return -1;
  }

  getFileSource(index: number) {
    const entry = this.entries[index];

    const localHeaderOffset = entry.localHeaderOffset;
    if (localHeaderOffset + 30 > this.data.length)
      throw new Error(`Invalid ZIP file`);

    const nameLength = this.data.readUInt16LE(localHeaderOffset + 26);
    const extraLength = this.data.readUInt16LE(localHeaderOffset + 28);

    const start = localHeaderOffset + 30 + nameLength + extraLength;
    const end = start + entry.compressedSize;
    if (end > this.data.length)
      throw new Error(`Invalid ZIP file`);

    return {data: this.data.subarray(start, end), compressionMethod: entry.compressionMethod};
  }

  discard(): void {
    this.data = Buffer.alloc(0);
    this.entries = [];
  }

  addDirectory(path: string): number {
    throw new Error(`Not implemented`);
  }

  deleteEntry(index: number): void {
    throw new Error(`Not implemented`);
  }

  setMtime(index: number, mtime: number): void {
    throw new Error(`Not implemented`);
  }

  getBufferAndClose(): Buffer {
    throw new Error(`Not implemented`);
  }

  setFileSource(target: PortablePath, compression: CompressionData, buffer: Buffer): number {
    throw new Error(`Not implemented`);
  }

  setExternalAttributes(index: number, opsys: number, attributes: number): void {
    throw new Error(`Not implemented`);
  }
}
