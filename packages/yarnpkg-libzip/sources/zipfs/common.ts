import {Stats}        from '@yarnpkg/fslib';
import {FakeFS}       from '@yarnpkg/fslib';
import {PortablePath} from '@yarnpkg/fslib';
import {types}        from 'util';

export type ZipCompression = `mixed` | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export const DEFAULT_COMPRESSION_LEVEL: ZipCompression = `mixed`;

export type ZipBufferOptions = {
  readOnly?: boolean;
  stats?: Stats;
  level?: ZipCompression;
};

export type ZipPathOptions = ZipBufferOptions & {
  baseFs?: FakeFS<PortablePath>;
  create?: boolean;
};

export function toUnixTimestamp(time: Date | string | number): number {
  if (typeof time === `string` && String(+time) === time)
    return +time;

  if (typeof time === `number` && Number.isFinite(time)) {
    if (time < 0) {
      return Date.now() / 1000;
    } else {
      return time;
    }
  }

  // convert to 123.456 UNIX timestamp
  if (types.isDate(time))
    return (time as Date).getTime() / 1000;

  throw new Error(`Invalid time`);
}

export function makeEmptyArchive() {
  return Buffer.from([
    0x50, 0x4B, 0x05, 0x06,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00,
  ]);
}
