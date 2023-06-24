import {PortablePath} from '@yarnpkg/fslib';
import fs             from 'fs';

import * as tgzUtils  from './tgzUtils';

export const TarFileTypeMap = {
  0: `File`,
  5: `Directory`,
} as const;

export type TarFileType = (typeof TarFileTypeMap)[keyof typeof TarFileTypeMap];

export function parseTarEntries(source: Buffer) {
  const entries: Array<{
    type: TarFileType;
    path: PortablePath;
    offset: number;
    size: number;
    mode: number;
  }> = [];

  let offset = 0;

  while (offset < source.byteLength) {
    const path = source.toString(`utf8`, offset, offset + 100).replace(/\0.*$/, ``);
    if (!path) {
      offset += 512;
      continue;
    }

    const mode = parseInt(source.toString(`utf8`, offset + 100, offset + 108), 8);
    const size = parseInt(source.toString(`utf8`, offset + 124, offset + 136), 8);
    const type = (source[offset + 156] || `0`);
    const prefix = source.toString(`utf8`, offset + 345, offset + 500).toString().replace(/\0.*$/, ``);

    entries.push({
      path: `${prefix}${path}` as PortablePath,
      type: (TarFileTypeMap as any)[type] ?? `Unknown`,
      offset: offset + 512,
      size,
      mode,
    });

    offset += 512 + Math.ceil(size / 512) * 512;
  }

  return entries;
}

async function testConvertToZip3rdParty(tgz: Buffer) {
  const start2 = Date.now();

  await tgzUtils.convertToZip3rdParty(tgz, {
    compressionLevel: 0,
  });

  console.log(`convertToZip3rdParty: ${Date.now() - start2}ms`);
}

async function testConvertToZipCustomJs(tgz: Buffer) {
  const start2 = Date.now();

  await tgzUtils.convertToZipCustomJs(tgz, {
    compressionLevel: 0,
  });

  console.log(`testConvertToZipCustomJs: ${Date.now() - start2}ms`);
}

function testConvertToZipWasm(tgz: Buffer) {
  const start2 = Date.now();

  tgzUtils.convertToZipWasm(tgz, {
    compressionLevel: 0,
  });

  console.log(`testConvertToZipWasm: ${Date.now() - start2}ms`);
}

async function test() {
  console.log(`Let's test the performance of the various tgz -> zip converters!`);

  const files = fs.readdirSync(`.`).filter(name => name.endsWith(`.tgz`));
  for (const f of files) {
    const tgz = fs.readFileSync(f);

    console.log();
    console.log(`=== ${f} ${tgz.byteLength / 1024} KiB ===`);
    console.log();

    for (let t = 0; t < 10; ++t)
      await testConvertToZip3rdParty(tgz);

    console.log();

    for (let t = 0; t < 10; ++t)
      await testConvertToZipCustomJs(tgz);

    console.log();

    for (let t = 0; t < 10; ++t) {
      testConvertToZipWasm(tgz);
    }
  }
}

//if (require.main === module)
//  test();
