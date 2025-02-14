import {FakeFS, PortablePath}                                                                     from '@yarnpkg/fslib';
import {constants}                                                                                from 'fs';

import {CompressionMethod, Stat, ZIP_UNIX, type CompressionData, type ZipImpl, type ZipImplInput} from './ZipFS';


const SIGNATURE = {
  CENTRAL_DIRECTORY: 0x02014b50,
  END_OF_CENTRAL_DIRECTORY: 0x06054b50,
};

const noCommentCDSize = 22;


export interface Entry {
  name: string;
  compressionMethod: CompressionMethod;
  size: number;
  os: number;
  isSymbolicLink: boolean;
  crc: number;
  compressedSize: number;
  externalAttributes: number;
  mtime: number;
  fileContentOffset: number;
}

export class JsZipImpl implements ZipImpl {
  fd: number;
  baseFs: FakeFS<PortablePath>;
  entries: Array<Entry>;

  constructor(opts: ZipImplInput) {
    if (`buffer` in opts)
      throw new Error(`Buffer based zip archives are not supported`);

    if (!opts.readOnly)
      throw new Error(`Writable zip archives are not supported`);

    this.baseFs = opts.baseFs;
    this.fd = this.baseFs.openSync(opts.path, `r`);
    this.entries = JsZipImpl.readZipSync(this.fd, this.baseFs);
  }

  static readZipSync(fd: number, baseFs: FakeFS<PortablePath>): Array<Entry> {
    const stats = baseFs.fstatSync(fd);
    const fileSize = stats.size;

    if (fileSize < noCommentCDSize)
      throw new Error(`Invalid ZIP file: EOCD not found`);


    let eocdOffset = -1;

    // fast read if no comment
    let cdBuffer = Buffer.alloc(noCommentCDSize);
    baseFs.readSync(
      fd,
      cdBuffer,
      0,
      noCommentCDSize,
      fileSize - noCommentCDSize,
    );

    if (cdBuffer.readUInt32LE(0) === SIGNATURE.END_OF_CENTRAL_DIRECTORY) {
      eocdOffset = 0;
    } else {
      const bufferSize = Math.min(65557, fileSize);
      cdBuffer = Buffer.alloc(bufferSize);

      // Read potential EOCD area
      baseFs.readSync(
        fd,
        cdBuffer,
        0,
        bufferSize,
        Math.max(0, fileSize - bufferSize),
      );

      // Find EOCD signature
      for (let i = cdBuffer.length - 4; i >= 0; i--) {
        if (cdBuffer.readUInt32LE(i) === SIGNATURE.END_OF_CENTRAL_DIRECTORY) {
          eocdOffset = i;
          break;
        }
      }
      if (eocdOffset === -1) {
        throw new Error(`Invalid ZIP file: EOCD not found`);
      }
    }


    const totalEntries = cdBuffer.readUInt16LE(eocdOffset + 10);
    const centralDirSize = cdBuffer.readUInt32LE(eocdOffset + 12);
    const centralDirOffset = cdBuffer.readUInt32LE(eocdOffset + 16);

    // Read central directory
    const centralDirBuffer = Buffer.alloc(centralDirSize);
    baseFs.readSync(fd, centralDirBuffer, 0, centralDirBuffer.length, centralDirOffset);

    const entries: Array<Entry> = [];
    let offset = 0;
    let index = 0;
    while (offset < centralDirBuffer.length && index < totalEntries) {
      if (centralDirBuffer.readUInt32LE(offset) !== SIGNATURE.CENTRAL_DIRECTORY) break;
      const versionMadeBy = centralDirBuffer.readUInt16LE(offset + 4);
      const os = versionMadeBy >>> 8;
      const compressionMethod = centralDirBuffer.readUInt16LE(offset + 10) as CompressionMethod;
      const crc = centralDirBuffer.readUInt32LE(offset + 16);
      const nameLength = centralDirBuffer.readUInt16LE(offset + 28);
      const extraLength = centralDirBuffer.readUInt16LE(offset + 30);
      const commentLength = centralDirBuffer.readUInt16LE(offset + 32);
      const localHeaderOffset = centralDirBuffer.readUInt32LE(offset + 42);
      const name = centralDirBuffer.toString(`utf8`, offset + 46, offset + 46 + nameLength);
      const fileContentOffset = localHeaderOffset + 30 + nameLength + extraLength;
      const externalAttributes = centralDirBuffer.readUInt32LE(offset + 38);

      entries.push({
        name,
        os,
        mtime: 0, //we dont care,
        crc,
        compressionMethod,
        isSymbolicLink: os === ZIP_UNIX && ((externalAttributes >>> 16) & constants.S_IFMT) === constants.S_IFLNK,
        size: centralDirBuffer.readUInt32LE(offset + 24),
        compressedSize: centralDirBuffer.readUInt32LE(offset + 20),
        externalAttributes,
        fileContentOffset,
      });

      index += 1;
      offset += 46 + nameLength + extraLength + commentLength;
    }

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
    for (const entry of this.entries) {
      if (entry.isSymbolicLink) {
        count += 1;
      }
    }
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
    for (let ind = 0; ind < this.entries.length; ind++) {
      if (this.entries[ind].name === name) {
        return ind;
      }
    }
    return -1;
  }

  getFileSource(index: number): { data: Buffer, compressionMethod: CompressionMethod } {
    const entry = this.entries[index];
    const buffer = Buffer.alloc(entry.compressedSize);
    this.baseFs.readSync(this.fd, buffer, 0, entry.compressedSize, entry.fileContentOffset);
    return {data: buffer, compressionMethod: entry.compressionMethod};
  }
  discard(): void {

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
