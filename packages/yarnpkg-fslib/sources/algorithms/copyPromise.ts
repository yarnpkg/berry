import {Stats}             from 'fs';

import {FakeFS}            from '../FakeFS';
import * as constants      from '../constants';
import {Path, convertPath, PortablePath} from '../path';

const defaultTime = new Date(constants.SAFE_TIME * 1000);
const defaultTimeMs = defaultTime.getTime();

export type HardlinkFromIndexStrategy<P> = {
  type: `HardlinkFromIndex`;
  indexPath: P;
  autoRepair?: boolean;
  readOnly?: boolean;
};

export type LinkStrategy<P> =
  | HardlinkFromIndexStrategy<P>;

export type CopyOptions<P> = {
  linkStrategy: LinkStrategy<P> | null;
  stableTime: boolean;
  stableSort: boolean;
  overwrite: boolean;
};

export type Operations =
  Array<() => Promise<void>>;

export type LUTimes<P extends Path> =
  Array<[P, Date | number, Date | number]>;

export async function setupCopyIndex<P extends Path>(destinationFs: FakeFS<P>, linkStrategy: Pick<HardlinkFromIndexStrategy<P>, `indexPath`>) {
  const hexCharacters = `0123456789abcdef`;
  await destinationFs.mkdirPromise(linkStrategy.indexPath, {recursive: true});

  const promises: Array<Promise<any>> = [];
  for (const l1 of hexCharacters)
    for (const l2 of hexCharacters)
      promises.push(destinationFs.mkdirPromise(destinationFs.pathUtils.join(linkStrategy.indexPath, `${l1}${l2}` as any), {recursive: true}));

  await Promise.all(promises);

  return linkStrategy.indexPath;
}

export async function copyPromise<P1 extends Path, P2 extends Path>(destinationFs: FakeFS<P1>, destination: P1, sourceFs: FakeFS<P2>, source: P2, opts: CopyOptions<P1>) {
  const normalizedDestination = destinationFs.pathUtils.normalize(destination);
  const normalizedSource = sourceFs.pathUtils.normalize(source);

  const prelayout: Operations = [];
  const postlayout: Operations = [];

  const {atime, mtime} = opts.stableTime
    ? {atime: defaultTime, mtime: defaultTime}
    : await sourceFs.lstatPromise(normalizedSource);

  await destinationFs.mkdirpPromise(destinationFs.pathUtils.dirname(destination), {utimes: [atime, mtime]});

  const updateTime = typeof destinationFs.lutimesPromise === `function`
    ? destinationFs.lutimesPromise.bind(destinationFs)
    : destinationFs.utimesPromise.bind(destinationFs);

  await copyImpl(prelayout, postlayout, updateTime, destinationFs, normalizedDestination, sourceFs, normalizedSource, {...opts, didParentExist: true});

  for (const operation of prelayout)
    await operation();

  await Promise.all(postlayout.map(operation => {
    return operation();
  }));
}

type InternalCopyOptions<P> = CopyOptions<P> & {
  didParentExist: boolean;
};

async function copyImpl<P1 extends Path, P2 extends Path>(prelayout: Operations, postlayout: Operations, updateTime: typeof FakeFS.prototype.utimesPromise, destinationFs: FakeFS<P1>, destination: P1, sourceFs: FakeFS<P2>, source: P2, opts: InternalCopyOptions<P1>) {
  const destinationStat = opts.didParentExist ? await maybeLStat(destinationFs, destination) : null;
  const sourceStat = await sourceFs.lstatPromise(source);

  const {atime, mtime} = opts.stableTime
    ? {atime: defaultTime, mtime: defaultTime}
    : sourceStat;

  let updated: boolean;
  switch (true) {
    case sourceStat.isDirectory(): {
      updated = await copyFolder(prelayout, postlayout, updateTime, destinationFs, destination, destinationStat, sourceFs, source, sourceStat, opts);
    } break;

    case sourceStat.isFile(): {
      updated = await copyFile(prelayout, postlayout, updateTime, destinationFs, destination, destinationStat, sourceFs, source, sourceStat, opts);
    } break;

    case sourceStat.isSymbolicLink(): {
      updated = await copySymlink(prelayout, postlayout, updateTime, destinationFs, destination, destinationStat, sourceFs, source, sourceStat, opts);
    } break;

    default: {
      throw new Error(`Unsupported file type (${sourceStat.mode})`);
    } break;
  }

  // We aren't allowed to modify the destination if we work with the index,
  // since otherwise we'd accidentally propagate the changes to all projects.
  if (opts.linkStrategy?.type !== `HardlinkFromIndex` || !sourceStat.isFile()) {
    if (updated || destinationStat?.mtime?.getTime() !== mtime.getTime() || destinationStat?.atime?.getTime() !== atime.getTime()) {
      postlayout.push(() => updateTime(destination, atime, mtime));
      updated = true;
    }

    if (destinationStat === null || (destinationStat.mode & 0o777) !== (sourceStat.mode & 0o777)) {
      postlayout.push(() => destinationFs.chmodPromise(destination, sourceStat.mode & 0o777));
      updated = true;
    }
  }

  return updated;
}

async function maybeLStat<P extends Path>(baseFs: FakeFS<P>, p: P) {
  try {
    return await baseFs.lstatPromise(p);
  } catch (e) {
    return null;
  }
}

async function copyFolder<P1 extends Path, P2 extends Path>(prelayout: Operations, postlayout: Operations, updateTime: typeof FakeFS.prototype.utimesPromise, destinationFs: FakeFS<P1>, destination: P1, destinationStat: Stats | null, sourceFs: FakeFS<P2>, source: P2, sourceStat: Stats, opts: InternalCopyOptions<P1>) {
  if (destinationStat !== null && !destinationStat.isDirectory()) {
    if (opts.overwrite) {
      prelayout.push(async () => destinationFs.removePromise(destination));
      destinationStat = null;
    } else {
      return false;
    }
  }

  let updated = false;

  if (destinationStat === null) {
    prelayout.push(async () => {
      try {
        await destinationFs.mkdirPromise(destination, {mode: sourceStat.mode});
      } catch (err) {
        if (err.code !== `EEXIST`) {
          throw err;
        }
      }
    });
    updated = true;
  }

  const entries = await sourceFs.readdirPromise(source);

  const nextOpts: InternalCopyOptions<P1> = opts.didParentExist && !destinationStat ? {...opts, didParentExist: false} : opts;

  if (opts.stableSort) {
    for (const entry of entries.sort()) {
      if (await copyImpl(prelayout, postlayout, updateTime, destinationFs, destinationFs.pathUtils.join(destination, entry), sourceFs, sourceFs.pathUtils.join(source, entry), nextOpts)) {
        updated = true;
      }
    }
  } else {
    const entriesUpdateStatus = await Promise.all(entries.map(async entry => {
      await copyImpl(prelayout, postlayout, updateTime, destinationFs, destinationFs.pathUtils.join(destination, entry), sourceFs, sourceFs.pathUtils.join(source, entry), nextOpts);
    }));

    if (entriesUpdateStatus.some(status => status)) {
      updated = true;
    }
  }

  return updated;
}

async function copyFileViaIndex<P1 extends Path, P2 extends Path>(prelayout: Operations, postlayout: Operations, updateTime: typeof FakeFS.prototype.utimesPromise, destinationFs: FakeFS<P1>, destination: P1, destinationStat: Stats | null, sourceFs: FakeFS<P2>, source: P2, sourceStat: Stats, opts: CopyOptions<P1>, linkStrategy: HardlinkFromIndexStrategy<P1>) {
  const sourceHash = await sourceFs.checksumFilePromise(source, {algorithm: `sha1`});
  const indexPath = destinationFs.pathUtils.join(linkStrategy.indexPath, sourceHash.slice(0, 2) as P1, `${sourceHash}.dat` as P1);

  let indexStat = await maybeLStat(destinationFs, indexPath);
  if (destinationStat) {
    const isDestinationHardlinkedFromIndex = indexStat && destinationStat.dev === indexStat.dev && destinationStat.ino === indexStat.ino;
    const isIndexModified = indexStat?.mtimeMs !== defaultTimeMs;

    if (isDestinationHardlinkedFromIndex)
      if (isIndexModified && linkStrategy.autoRepair)
        indexStat = null;

    if (!isDestinationHardlinkedFromIndex) {
      if (opts.overwrite) {
        prelayout.push(async () => destinationFs.removePromise(destination));
        destinationStat = null;
      } else {
        return false;
      }
    }
  }

  prelayout.push(async () => {
    if (!indexStat) {
        const tempPath = `${indexPath}.${(Math.random() * 0x100000000).toString(16).padStart(8, `0`)}` as P1;

        const content = await sourceFs.readFilePromise(source);
        await destinationFs.writeFilePromise(tempPath, content);
        await destinationFs.renamePromise(tempPath, indexPath);
    }

    if (!destinationStat) {
      await destinationFs.linkPromise(indexPath, destination);
    }
  });

  postlayout.push(async () => {
    if (!indexStat) {
      await updateTime(indexPath, defaultTime, defaultTime);
    }
  });

  return false;
}

async function copyFileDirect<P1 extends Path, P2 extends Path>(prelayout: Operations, postlayout: Operations, updateTime: typeof FakeFS.prototype.utimesPromise, destinationFs: FakeFS<P1>, destination: P1, destinationStat: Stats | null, sourceFs: FakeFS<P2>, source: P2, sourceStat: Stats, opts: CopyOptions<P1>) {
  if (destinationStat !== null) {
    if (opts.overwrite) {
      prelayout.push(async () => destinationFs.removePromise(destination));
      destinationStat = null;
    } else {
      return false;
    }
  }

  // TODO: Add support for file cloning, by adding a flag inside the FakeFS
  // instances to detect which "namespace" they're part of (for example, the
  // NodeFS and the ZipFS would be different namespaces since you can't clone
  // from one disk to the other; on the other hand, a CwdFS would share the
  // namespace from its base FS and thus would support cloning).

  prelayout.push(async () => {
    const content = await sourceFs.readFilePromise(source);
    await destinationFs.writeFilePromise(destination, content);
  });

  return true;
}

async function copyFile<P1 extends Path, P2 extends Path>(prelayout: Operations, postlayout: Operations, updateTime: typeof FakeFS.prototype.utimesPromise, destinationFs: FakeFS<P1>, destination: P1, destinationStat: Stats | null, sourceFs: FakeFS<P2>, source: P2, sourceStat: Stats, opts: CopyOptions<P1>) {
  if (opts.linkStrategy?.type === `HardlinkFromIndex`) {
    return copyFileViaIndex(prelayout, postlayout, updateTime, destinationFs, destination, destinationStat, sourceFs, source, sourceStat, opts, opts.linkStrategy);
  } else {
    return copyFileDirect(prelayout, postlayout, updateTime, destinationFs, destination, destinationStat, sourceFs, source, sourceStat, opts);
  }
}

async function copySymlink<P1 extends Path, P2 extends Path>(prelayout: Operations, postlayout: Operations, updateTime: typeof FakeFS.prototype.utimesPromise, destinationFs: FakeFS<P1>, destination: P1, destinationStat: Stats | null, sourceFs: FakeFS<P2>, source: P2, sourceStat: Stats, opts: CopyOptions<P1>) {
  if (destinationStat !== null) {
    if (opts.overwrite) {
      prelayout.push(async () => destinationFs.removePromise(destination));
      destinationStat = null;
    } else {
      return false;
    }
  }

  prelayout.push(async () => {
    await destinationFs.symlinkPromise(convertPath(destinationFs.pathUtils, await sourceFs.readlinkPromise(source)), destination);
  });

  return true;
}
