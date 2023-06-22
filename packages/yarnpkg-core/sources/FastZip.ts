import {PortablePath} from '@yarnpkg/fslib';
import fs             from 'fs';
import zlib           from 'zlib';

import {crc32}        from './crc32';
import {convertToZip} from './tgzUtils';

const DEFAULT_TIME = 0x0000;

export function parseTarEntries(source: Buffer) {
  const entries: Array<{
    path: PortablePath;
    offset: number;
    size: number;
  }> = [];

  let offset = 0;

  while (offset < source.byteLength) {
    const path = source.toString(`utf8`, offset, offset + 100).toString().replace(/\0.*$/, ``);
    if (!path) {
      offset += 512;
      continue;
    }

    const size = parseInt(source.toString(`utf8`, offset + 124, offset + 136).toString().replace(/\0.*$/, ``), 8);

    entries.push({
      path: path as PortablePath,
      offset: offset + 512,
      size,
    });

    offset += 512 + Math.ceil(size / 512) * 512;
  }

  return entries;
}

export function genZipArchive(source: Buffer, files: Array<{path: PortablePath, offset: number, size: number}>) {
  const records: Array<{
    position: number;
    path: PortablePath;
    offset: number;
    size: number;
    crc32: number;
  }> = [];

  let currentPosition = 0;

  for (const file of files) {
    records.push({
      position: currentPosition,
      path: file.path,
      offset: file.offset,
      size: file.size,
      crc32: 0, //crc32(source, file.offset, file.offset + file.size),
    });

    currentPosition += 30 + file.path.length + file.size;
  }

  const dataSize = files.reduce((sum, {size}) => sum + size, 0);
  const localFileHeaderSize = 30 * files.length + files.reduce((sum, {path}) => sum + path.length, 0);
  const centralDirectorySize = 46 * files.length + files.reduce((sum, {path}) => sum + path.length, 0);
  const zipSize = dataSize + localFileHeaderSize + centralDirectorySize + 22;

  const zip = Buffer.alloc(zipSize);

  let idx = 0;

  for (let t = 0; t < files.length; ++t)
    genLocalFileHeader(t);
  for (let t = 0; t < files.length; ++t)
    genCentralDirectoryFileHeader(t);

  genEndOfCentralDirectoryRecord();

  if (idx !== zip.byteLength)
    throw new Error(`Assertion failed: The generated zip archive size (${idx}) doesn't match the expected size (${zip.byteLength})`);

  return zip;

  function genEndOfCentralDirectoryRecord() {
    zip.writeUInt32LE(0x06054b50, idx); // end of central dir signature
    zip.writeUInt16LE(files.length, idx + 8); // total number of entries in the central directory on this disk
    zip.writeUInt16LE(files.length, idx + 10); // total number of entries in the central directory
    zip.writeUInt32LE(centralDirectorySize, idx + 12); // size of the central directory
    zip.writeUInt32LE(currentPosition, idx + 16); // offset of start of central directory with respect to the starting disk number

    idx += 22;
  }

  function genCentralDirectoryFileHeader(n: number) {
    zip.writeUInt32LE(0x02014b50, idx); // central file header signature
    zip.writeUInt16LE(DEFAULT_TIME, idx + 12); // last mod file time
    zip.writeUInt16LE(DEFAULT_TIME, idx + 14); // last mod file date
    zip.writeUInt32LE(records[n].crc32, idx + 16); // crc-32
    zip.writeUInt32LE(records[n].size, idx + 20); // compressed size
    zip.writeUInt32LE(records[n].size, idx + 24); // uncompressed size
    zip.writeUInt16LE(records[n].path.length, idx + 28); // file name length
    zip.writeUInt32LE(records[n].position, idx + 42); // relative offset of local header
    zip.write(records[n].path, idx + 46, records[n].path.length, `utf-8`); // file name

    idx += 46 + records[n].path.length;
  }

  function genLocalFileHeader(n: number) {
    zip.writeUInt32LE(0x04034b50, idx); // local file header signature
    zip.writeUInt16LE(0x0014, idx + 4); // version needed to extract (minimum)
    zip.writeUInt16LE(DEFAULT_TIME, idx + 10); // last mod file time
    zip.writeUInt16LE(DEFAULT_TIME, idx + 12); // last mod file date
    zip.writeUInt32LE(records[n].crc32, idx + 14); // crc-32
    zip.writeUInt32LE(records[n].size, idx + 18); // compressed size
    zip.writeUInt32LE(records[n].size, idx + 22); // uncompressed size
    zip.writeUInt16LE(records[n].path.length, idx + 26); // file name length
    zip.write(records[n].path, idx + 30, records[n].path.length, `utf-8`); // file name
    source.copy(zip, idx + 30 + records[n].path.length, records[n].offset, records[n].offset + records[n].size);

    idx += 30 + records[n].path.length + records[n].size;
  }
}

const tgz = fs.readFileSync(`lodash-4.17.21.tgz`);

const start = Date.now();
const tar = zlib.gunzipSync(tgz);
console.log(`Manual Gunzip: ${Date.now() - start}ms`);
const entries = parseTarEntries(tar);
console.log(`Manual parse: ${Date.now() - start}ms`);
const zip = genZipArchive(tar, entries);
console.log(`Manual zip: ${Date.now() - start}ms`);

console.log();

const start2 = Date.now();
const x = convertToZip(tgz, {
  compressionLevel: 0,
}).then(() => {
  console.log(`convertToZip: ${Date.now() - start2}ms`);
});
