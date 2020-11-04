import {Stats}                             from 'fs';

import {S_IFDIR, S_IFLNK, S_IFMT, S_IFREG} from './constants';
import {Filename}                          from './path';

export class DirEntry {
  public name: Filename = `` as Filename;
  public mode: number = 0;

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

export class StatEntry {
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

export function makeDefaultStats() {
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
  } as const);
}

export function makeEmptyStats() {
  return Object.assign(makeDefaultStats(), {
    nlink: 0,
    blocks: 0,
    mode: 0,
  } as const);
}

export function areStatsEqual(a: Stats, b: Stats): boolean {
  if (a.atimeMs !== b.atimeMs)
    return false;

  if (a.birthtimeMs !== b.birthtimeMs)
    return false;

  if (a.blksize !== b.blksize)
    return false;

  if (a.blocks !== b.blocks)
    return false;

  if (a.ctimeMs !== b.ctimeMs)
    return false;

  if (a.dev !== b.dev)
    return false;

  if (a.gid !== b.gid)
    return false;

  if (a.ino !== b.ino)
    return false;

  if (a.isBlockDevice() !== b.isBlockDevice())
    return false;

  if (a.isCharacterDevice() !== b.isCharacterDevice())
    return false;

  if (a.isDirectory() !== b.isDirectory())
    return false;

  if (a.isFIFO() !== b.isFIFO())
    return false;

  if (a.isFile() !== b.isFile())
    return false;

  if (a.isSocket() !== b.isSocket())
    return false;

  if (a.isSymbolicLink() !== b.isSymbolicLink())
    return false;

  if (a.mode !== b.mode)
    return false;

  if (a.mtimeMs !== b.mtimeMs)
    return false;

  if (a.nlink !== b.nlink)
    return false;

  if (a.rdev !== b.rdev)
    return false;

  if (a.size !== b.size)
    return false;

  if (a.uid !== b.uid)
    return false;

  return true;
}
