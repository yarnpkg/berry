import {Stats}             from 'fs';

import {FakeFS}            from '../FakeFS';
import * as constants      from '../constants';
import {Path, convertPath} from '../path';

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

  await copyImpl(prelayout, postlayout, destinationFs, normalizedDestination, sourceFs, normalizedSource, {...opts, didParentExist: true});

  for (const operation of prelayout)
    await operation();

  await Promise.all(postlayout.map(operation => {
    return operation();
  }));
}

type InternalCopyOptions<P> = CopyOptions<P> & {
  didParentExist: boolean;
};

async function copyImpl<P1 extends Path, P2 extends Path>(prelayout: Operations, postlayout: Operations, destinationFs: FakeFS<P1>, destination: P1, sourceFs: FakeFS<P2>, source: P2, opts: InternalCopyOptions<P1>) {
  const destinationStat = opts.didParentExist ? await maybeLStat(destinationFs, destination) : null;
  const sourceStat = await sourceFs.lstatPromise(source);

  const {atime, mtime} = opts.stableTime
    ? {atime: defaultTime, mtime: defaultTime}
    : sourceStat;

  let updated: boolean;
  switch (true) {
    case sourceStat.isDirectory(): {
      updated = await copyFolder(prelayout, postlayout, destinationFs, destination, destinationStat, sourceFs, source, sourceStat, opts);
    } break;

    case sourceStat.isFile(): {
      updated = await copyFile(prelayout, postlayout, destinationFs, destination, destinationStat, sourceFs, source, sourceStat, opts);
    } break;

    case sourceStat.isSymbolicLink(): {
      updated = await copySymlink(prelayout, postlayout, destinationFs, destination, destinationStat, sourceFs, source, sourceStat, opts);
    } break;

    default: {
      throw new Error(`Unsupported file type (${sourceStat.mode})`);
    }
  }

  // We aren't allowed to modify the destination if we work with the index,
  // since otherwise we'd accidentally propagate the changes to all projects.
  if (opts.linkStrategy?.type !== `HardlinkFromIndex` || !sourceStat.isFile()) {
    if (updated || destinationStat?.mtime?.getTime() !== mtime.getTime() || destinationStat?.atime?.getTime() !== atime.getTime()) {
      postlayout.push(() => destinationFs.lutimesPromise(destination, atime, mtime));
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

async function copyFolder<P1 extends Path, P2 extends Path>(prelayout: Operations, postlayout: Operations, destinationFs: FakeFS<P1>, destination: P1, destinationStat: Stats | null, sourceFs: FakeFS<P2>, source: P2, sourceStat: Stats, opts: InternalCopyOptions<P1>) {
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
      if (await copyImpl(prelayout, postlayout, destinationFs, destinationFs.pathUtils.join(destination, entry), sourceFs, sourceFs.pathUtils.join(source, entry), nextOpts)) {
        updated = true;
      }
    }
  } else {
    const entriesUpdateStatus = await Promise.all(entries.map(async entry => {
      await copyImpl(prelayout, postlayout, destinationFs, destinationFs.pathUtils.join(destination, entry), sourceFs, sourceFs.pathUtils.join(source, entry), nextOpts);
    }));

    if (entriesUpdateStatus.some(status => status)) {
      updated = true;
    }
  }

  return updated;
}

async function copyFileViaIndex<P1 extends Path, P2 extends Path>(prelayout: Operations, postlayout: Operations, destinationFs: FakeFS<P1>, destination: P1, destinationStat: Stats | null, sourceFs: FakeFS<P2>, source: P2, sourceStat: Stats, opts: CopyOptions<P1>, linkStrategy: HardlinkFromIndexStrategy<P1>) {
  const sourceHash = await sourceFs.checksumFilePromise(source, {algorithm: `sha1`});

  const defaultMode = 0o644;
  const sourceMode = sourceStat.mode & 0o777;

  // add mode to the index file name if it's not the default b/c different packages could have the file with same content, but different modes
  const indexFileName = `${sourceHash}${sourceMode !== defaultMode ? sourceMode.toString(8) : ``}`;
  const indexPath = destinationFs.pathUtils.join(linkStrategy.indexPath, sourceHash.slice(0, 2) as P1, `${indexFileName}.dat` as P1);

  enum AtomicBehavior {
    Lock,
    Rename,
  }

  let atomicBehavior = AtomicBehavior.Rename;

  let indexStat = await maybeLStat(destinationFs, indexPath);
  if (destinationStat) {
    const isDestinationHardlinkedFromIndex = indexStat && destinationStat.dev === indexStat.dev && destinationStat.ino === indexStat.ino;
    const isIndexModified = indexStat?.mtimeMs !== defaultTimeMs;

    if (isDestinationHardlinkedFromIndex) {
      // If the index is modified, we will want to repair it. However, the
      // default logic ensuring atomicity (creating a file in a temporary
      // place before atomically moving it into its final location) won't
      // work: we'd lose all the existing hardlinks.
      //
      // To avoid that, when repairing a file, we fallback to the slow but
      // safer `lockPromise`-based mutex, which will prevent multiple
      // processes to modify the file without impacting their inode.
      //
      // Give that the repair mechanism should be very rarely needed in
      // situation where performance is critical, it should be ok.
      //
      if (isIndexModified && linkStrategy.autoRepair) {
        atomicBehavior = AtomicBehavior.Lock;
        indexStat = null;
      }
    }

    if (!isDestinationHardlinkedFromIndex) {
      if (opts.overwrite) {
        prelayout.push(async () => destinationFs.removePromise(destination));
        destinationStat = null;
      } else {
        return false;
      }
    }
  }

  const tempPath = !indexStat && atomicBehavior === AtomicBehavior.Rename
    ? `${indexPath}.${Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, `0`)}` as P1
    : null;

  let tempPathCleaned = false;

  prelayout.push(async () => {
    if (!indexStat) {
      if (atomicBehavior === AtomicBehavior.Lock) {
        await destinationFs.lockPromise(indexPath, async () => {
          const content = await sourceFs.readFilePromise(source);
          await destinationFs.writeFilePromise(indexPath, content);
        });
      }

      if (atomicBehavior === AtomicBehavior.Rename && tempPath) {
        const content = await sourceFs.readFilePromise(source);
        await destinationFs.writeFilePromise(tempPath, content);

        // We use `linkPromise` rather than `renamePromise` because the later
        // overwrites the destination if it already exists; usually this
        // wouldn't be a problem, but since we care about preserving the
        // hardlink identity of the destination, we can't do that.
        //
        // So instead we create a hardlink of the source file (which will
        // fail with EEXIST if the destination already exists), and we remove
        // the source in the postlayout steps.
        //
        try {
          await destinationFs.linkPromise(tempPath, indexPath);
        } catch (err) {
          if (err.code === `EEXIST`) {
            tempPathCleaned = true;
            await destinationFs.unlinkPromise(tempPath);
          } else {
            throw err;
          }
        }
      }
    }

    if (!destinationStat) {
      await destinationFs.linkPromise(indexPath, destination);
    }
  });

  postlayout.push(async () => {
    if (!indexStat) {
      await destinationFs.lutimesPromise(indexPath, defaultTime, defaultTime);
      if (sourceMode !== defaultMode) {
        await destinationFs.chmodPromise(indexPath, sourceMode);
      }
    }

    if (tempPath && !tempPathCleaned) {
      await destinationFs.unlinkPromise(tempPath);
    }
  });

  return false;
}

async function copyFileDirect<P1 extends Path, P2 extends Path>(prelayout: Operations, postlayout: Operations, destinationFs: FakeFS<P1>, destination: P1, destinationStat: Stats | null, sourceFs: FakeFS<P2>, source: P2, sourceStat: Stats, opts: CopyOptions<P1>) {
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

async function copyFile<P1 extends Path, P2 extends Path>(prelayout: Operations, postlayout: Operations, destinationFs: FakeFS<P1>, destination: P1, destinationStat: Stats | null, sourceFs: FakeFS<P2>, source: P2, sourceStat: Stats, opts: CopyOptions<P1>) {
  if (opts.linkStrategy?.type === `HardlinkFromIndex`) {
    return copyFileViaIndex(prelayout, postlayout, destinationFs, destination, destinationStat, sourceFs, source, sourceStat, opts, opts.linkStrategy);
  } else {
    return copyFileDirect(prelayout, postlayout, destinationFs, destination, destinationStat, sourceFs, source, sourceStat, opts);
  }
}

async function copySymlink<P1 extends Path, P2 extends Path>(prelayout: Operations, postlayout: Operations, destinationFs: FakeFS<P1>, destination: P1, destinationStat: Stats | null, sourceFs: FakeFS<P2>, source: P2, sourceStat: Stats, opts: CopyOptions<P1>) {
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
