// This file shouldn't import other libui files, ink, or react.

import os            from 'os';
import {Writable}    from 'stream';
import {WriteStream} from 'tty';

export function checkRequirements({stdout}: {stdout: Writable}) {
  if (os.endianness() === `BE`)
    throw new Error(`Interactive commands cannot be used on big-endian systems because ink depends on yoga-layout-prebuilt which only supports little-endian architectures`);

  if (!(stdout as WriteStream).isTTY) {
    throw new Error(`Interactive commands can only be used inside a TTY environment`);
  }
}
