import fs, {Stats}         from 'fs';

import {FakeFS}            from '../FakeFS';
import {Path, convertPath} from '../path';

export type CopyOptions = {
  overwrite: boolean,
};

export type Operations =
  Array<() => Promise<void>>;

export type UTimes<P extends Path> =
  Array<[P, Date, Date]>;

export async function copyPromise<P1 extends Path, P2 extends Path>(destinationFs: FakeFS<P1>, destination: P1, sourceFs: FakeFS<P2>, source: P2, opts: CopyOptions) {
  const normalizedDestination = destinationFs.pathUtils.normalize(destination);
  const normalizedSource = sourceFs.pathUtils.normalize(source);

  const operations: Operations = [];
  const utimes: UTimes<P1> = [];

  await destinationFs.mkdirpPromise(destination);

  await copyImpl(operations, utimes, destinationFs, normalizedDestination, sourceFs, normalizedSource, opts);

  for (const operation of operations)
    await operation();

  for (const [p, atime, mtime] of utimes) {
    await destinationFs.utimesPromise(p, atime, mtime);
  }
}

async function copyImpl<P1 extends Path, P2 extends Path>(operations: Operations, utimes: UTimes<P1>, destinationFs: FakeFS<P1>, destination: P1, sourceFs: FakeFS<P2>, source: P2, opts: CopyOptions) {
  const destinationStat = await maybeLStat(destinationFs, destination);
  const sourceStat = await sourceFs.lstatPromise(source);

  utimes.push([destination, sourceStat.atime, sourceStat.mtime]);

  switch (true) {
    case sourceStat.isDirectory(): {
      await copyFolder(operations, utimes, destinationFs, destination, destinationStat, sourceFs, source, sourceStat, opts);
    } break;

    case sourceStat.isFile(): {
      await copyFile(operations, utimes, destinationFs, destination, destinationStat, sourceFs, source, sourceStat, opts);
    } break;

    case sourceStat.isSymbolicLink(): {
      await copySymlink(operations, utimes, destinationFs, destination, destinationStat, sourceFs, source, sourceStat, opts);
    } break;

    default: {
      throw new Error(`Unsupported file type (${sourceStat.mode})`);
    } break;
  }

  operations.push(async () => destinationFs.chmodPromise(destination, sourceStat.mode & 0o777));
}

async function maybeLStat<P extends Path>(baseFs: FakeFS<P>, p: P) {
  try {
    return await baseFs.lstatPromise(p);
  } catch (e) {
    return null;
  }
}

async function copyFolder<P1 extends Path, P2 extends Path>(operations: Operations, utimes: UTimes<P1>, destinationFs: FakeFS<P1>, destination: P1, destinationStat: Stats | null, sourceFs: FakeFS<P2>, source: P2, sourceStat: Stats, opts: CopyOptions) {
  if (destinationStat !== null && !destinationStat.isDirectory()) {
    if (opts.overwrite) {
      operations.push(async () => destinationFs.removePromise(destination));
      destinationStat = null;
    } else {
      return;
    }
  }

  if (destinationStat === null)
    operations.push(async () => destinationFs.mkdirPromise(destination, {mode: sourceStat.mode}));

  const entries = await sourceFs.readdirPromise(source);

  await Promise.all(entries.map(async entry => {
    await copyImpl(operations, utimes, destinationFs, destinationFs.pathUtils.join(destination, entry), sourceFs, sourceFs.pathUtils.join(source, entry), opts);
  }));
}

async function copyFile<P1 extends Path, P2 extends Path>(operations: Operations, utimes: UTimes<P1>, destinationFs: FakeFS<P1>, destination: P1, destinationStat: Stats | null, sourceFs: FakeFS<P2>, source: P2, sourceStat: Stats, opts: CopyOptions) {
  if (destinationStat !== null) {
    if (opts.overwrite) {
      operations.push(async () => destinationFs.removePromise(destination));
      destinationStat = null;
    } else {
      return;
    }
  }

  if (destinationFs as any === sourceFs as any) {
    operations.push(async () => destinationFs.copyFilePromise(source as any as P1, destination, fs.constants.COPYFILE_FICLONE));
  } else {
    operations.push(async () => destinationFs.writeFilePromise(destination, await sourceFs.readFilePromise(source)));
  }
}

async function copySymlink<P1 extends Path, P2 extends Path>(operations: Operations, utimes: UTimes<P1>, destinationFs: FakeFS<P1>, destination: P1, destinationStat: Stats | null, sourceFs: FakeFS<P2>, source: P2, sourceStat: Stats, opts: CopyOptions) {
  if (destinationStat !== null) {
    if (opts.overwrite) {
      operations.push(async () => destinationFs.removePromise(destination));
      destinationStat = null;
    } else {
      return;
    }
  }

  const target = await sourceFs.readlinkPromise(source);
  operations.push(async () => destinationFs.symlinkPromise(convertPath(destinationFs.pathUtils, target), destination));
}
