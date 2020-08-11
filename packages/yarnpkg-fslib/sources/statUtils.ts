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
  let areValuesEqual = true;
  const compareValues = <T extends number | boolean>(a: T, b: T) => {
    if (a !== b) {
      areValuesEqual = false;
    }
  };

  compareValues(a.atimeMs, b.atimeMs);
  compareValues(a.birthtimeMs, b.birthtimeMs);
  compareValues(a.blksize, b.blksize);
  compareValues(a.blocks, b.blocks);
  compareValues(a.ctimeMs, b.ctimeMs);
  compareValues(a.dev, b.dev);
  compareValues(a.gid, b.gid);
  compareValues(a.ino, b.ino);
  compareValues(a.isBlockDevice(), b.isBlockDevice());
  compareValues(a.isCharacterDevice(), b.isCharacterDevice());
  compareValues(a.isDirectory(), b.isDirectory());
  compareValues(a.isFIFO(), b.isFIFO());
  compareValues(a.isFile(), b.isFile());
  compareValues(a.isSocket(), b.isSocket());
  compareValues(a.isSymbolicLink(), b.isSymbolicLink());
  compareValues(a.mode, b.mode);
  compareValues(a.mtimeMs, b.mtimeMs);
  compareValues(a.nlink, b.nlink);
  compareValues(a.rdev, b.rdev);
  compareValues(a.size, b.size);
  compareValues(a.uid, b.uid);

  return areValuesEqual;
}
