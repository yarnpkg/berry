import {FakeFS, LazyFS, NodeFS, ZipFS, PortablePath, Filename, AliasFS} from '@yarnpkg/fslib';
import {ppath, xfs, DEFAULT_COMPRESSION_LEVEL}                          from '@yarnpkg/fslib';
import {getLibzipPromise}                                               from '@yarnpkg/libzip';
import fs                                                               from 'fs';

import {Configuration}                                                  from './Configuration';
import {MessageName}                                                    from './MessageName';
import {ReportError}                                                    from './Report';
import * as hashUtils                                                   from './hashUtils';
import * as miscUtils                                                   from './miscUtils';
import * as structUtils                                                 from './structUtils';
import {LocatorHash, Locator}                                           from './types';

const CACHE_VERSION = 8;

export type FetchFromCacheOptions = {
  checksums: Map<LocatorHash, Locator>,
};

export class Cache {
  public readonly configuration: Configuration;
  public readonly cwd: PortablePath;

  // Contains the list of cache files that got accessed since the last time
  // you cleared the variable. Useful to know which files aren't needed
  // anymore when used in conjunction with fetchEverything.
  public readonly markedFiles: Set<PortablePath> = new Set();

  // If true, the cache will require the cache files to exist and will never
  // forward them to the fetcher implementations (unless `check` is set)
  public readonly immutable: boolean;

  // If true, the cache will always refetch the packages and will compare their
  // checksums against both what's stored within the lockfile and what's
  // presently in the cache (unless the package isn't in the cache in the first
  // place).
  public readonly check: boolean;

  public readonly cacheKey: string;

  private mutexes: Map<LocatorHash, Promise<readonly [PortablePath, string]>> = new Map();

  static async find(configuration: Configuration, {immutable, check}: {immutable?: boolean, check?: boolean} = {}) {
    const cache = new Cache(configuration.get(`cacheFolder`), {configuration, immutable, check});
    await cache.setup();

    return cache;
  }

  constructor(cacheCwd: PortablePath, {configuration, immutable = configuration.get(`enableImmutableCache`), check = false}: {configuration: Configuration, immutable?: boolean, check?: boolean}) {
    this.configuration = configuration;
    this.cwd = cacheCwd;

    this.immutable = immutable;
    this.check = check;

    const cacheKeyOverride = configuration.get(`cacheKeyOverride`);
    if (cacheKeyOverride !== null) {
      this.cacheKey = `${cacheKeyOverride}`;
    } else {
      const compressionLevel = configuration.get(`compressionLevel`);
      const compressionKey = compressionLevel !== DEFAULT_COMPRESSION_LEVEL
        ? `c${compressionLevel}` : ``;

      this.cacheKey = [
        CACHE_VERSION,
        compressionKey,
      ].join(``);
    }
  }

  get mirrorCwd() {
    if (!this.configuration.get(`enableMirror`))
      return null;

    const mirrorCwd = `${this.configuration.get(`globalFolder`)}/cache` as PortablePath;
    return mirrorCwd !== this.cwd ? mirrorCwd : null;
  }

  getVersionFilename(locator: Locator) {
    return `${structUtils.slugifyLocator(locator)}-${this.cacheKey}.zip` as Filename;
  }

  getChecksumFilename(locator: Locator, checksum: string) {
    // We only want the actual checksum (not the cache version, since the whole
    // point is to avoid changing the filenames when the cache version changes)
    const contentChecksum = getHashComponent(checksum);

    // We only care about the first few characters. It doesn't matter if that
    // makes the hash easier to collide with, because we check the file hashes
    // during each install anyway.
    const significantChecksum = contentChecksum.slice(0, 10);

    return `${structUtils.slugifyLocator(locator)}-${significantChecksum}.zip` as Filename;
  }

  getLocatorPath(locator: Locator, expectedChecksum: string | null) {
    // If there is no mirror, then the local cache *is* the mirror, in which
    // case we use the versioned filename pattern.
    if (this.mirrorCwd === null)
      return ppath.resolve(this.cwd, this.getVersionFilename(locator));

    // If we don't yet know the checksum, discard the path resolution for now
    // until the checksum can be obtained from somewhere (mirror or network).
    if (expectedChecksum === null)
      return null;

    // If the cache key changed then we assume that the content probably got
    // altered as well and thus the existing path won't be good enough anymore.
    const cacheKey = getCacheKeyComponent(expectedChecksum);
    if (cacheKey !== this.cacheKey)
      return null;

    return ppath.resolve(this.cwd, this.getChecksumFilename(locator, expectedChecksum));
  }

  getLocatorMirrorPath(locator: Locator) {
    const mirrorCwd = this.mirrorCwd;
    return mirrorCwd !== null ? ppath.resolve(mirrorCwd, this.getVersionFilename(locator)) : null;
  }

  async setup() {
    // mkdir may cause write operations even when directories exist. To ensure that the cache can be successfully used
    // on read-only filesystems, only run mkdir when not running in immutable mode.
    if (!this.configuration.get(`enableGlobalCache`)) {
      if (this.immutable) {
        if (!await xfs.existsPromise(this.cwd)) {
          throw new ReportError(MessageName.IMMUTABLE_CACHE, `Cache path does not exist.`);
        }
      } else {
        await xfs.mkdirPromise(this.cwd, {recursive: true});

        const gitignorePath = ppath.resolve(this.cwd, `.gitignore` as Filename);

        await xfs.changeFilePromise(gitignorePath, `/.gitignore\n*.flock\n`);
      }
    }

    if (this.mirrorCwd || !this.immutable) {
      await xfs.mkdirPromise(this.mirrorCwd || this.cwd, {recursive: true});
    }
  }

  async fetchPackageFromCache(locator: Locator, expectedChecksum: string | null, {onHit, onMiss, loader, skipIntegrityCheck}: {onHit?: () => void, onMiss?: () => void, loader?: () => Promise<ZipFS>, skipIntegrityCheck?: boolean}): Promise<[FakeFS<PortablePath>, () => void, string]> {
    const mirrorPath = this.getLocatorMirrorPath(locator);

    const baseFs = new NodeFS();

    const validateFile = async (path: PortablePath, refetchPath: PortablePath | null = null) => {
      const actualChecksum = (!skipIntegrityCheck || !expectedChecksum) ? `${this.cacheKey}/${await hashUtils.checksumFile(path)}` : expectedChecksum;

      if (refetchPath !== null) {
        const previousChecksum = (!skipIntegrityCheck || !expectedChecksum) ? `${this.cacheKey}/${await hashUtils.checksumFile(refetchPath)}` : expectedChecksum;
        if (actualChecksum !== previousChecksum) {
          throw new ReportError(MessageName.CACHE_CHECKSUM_MISMATCH, `The remote archive doesn't match the local checksum - has the local cache been corrupted?`);
        }
      }

      if (expectedChecksum !== null && actualChecksum !== expectedChecksum) {
        let checksumBehavior;

        // Using --check-cache overrides any preconfigured checksum behavior
        if (this.check)
          checksumBehavior = `throw`;
        // If the lockfile references an old cache format, we tolerate different checksums
        else if (getCacheKeyComponent(expectedChecksum) !== getCacheKeyComponent(actualChecksum))
          checksumBehavior = `update`;
        else
          checksumBehavior = this.configuration.get(`checksumBehavior`);

        switch (checksumBehavior) {
          case `ignore`:
            return expectedChecksum;

          case `update`:
            return actualChecksum;

          default:
          case `throw`: {
            throw new ReportError(MessageName.CACHE_CHECKSUM_MISMATCH, `The remote archive doesn't match the expected checksum`);
          }
        }
      }

      return actualChecksum;
    };

    const validateFileAgainstRemote = async (cachePath: PortablePath) => {
      if (!loader)
        throw new Error(`Cache check required but no loader configured for ${structUtils.prettyLocator(this.configuration, locator)}`);

      const zipFs = await loader();
      const refetchPath = zipFs.getRealPath();

      zipFs.saveAndClose();

      await xfs.chmodPromise(refetchPath, 0o644);

      return await validateFile(cachePath, refetchPath);
    };

    const loadPackageThroughMirror = async () => {
      if (mirrorPath === null || !(await xfs.existsPromise(mirrorPath))) {
        const zipFs = await loader!();
        const realPath = zipFs.getRealPath();
        zipFs.saveAndClose();
        return {source: `loader`, path: realPath} as const;
      }

      const tempDir = await xfs.mktempPromise();
      const tempPath = ppath.join(tempDir, this.getVersionFilename(locator));

      await xfs.copyFilePromise(mirrorPath, tempPath, fs.constants.COPYFILE_FICLONE);
      return {source: `mirror`, path: tempPath} as const;
    };

    const loadPackage = async () => {
      if (!loader)
        throw new Error(`Cache entry required but missing for ${structUtils.prettyLocator(this.configuration, locator)}`);
      if (this.immutable)
        throw new ReportError(MessageName.IMMUTABLE_CACHE, `Cache entry required but missing for ${structUtils.prettyLocator(this.configuration, locator)}`);

      const {path: cachePathTemp, source: packageSource} = await loadPackageThroughMirror();

      await xfs.chmodPromise(cachePathTemp, 0o644);

      // Do this before moving the file so that we don't pollute the cache with corrupted archives
      const checksum = await validateFile(cachePathTemp);

      const cachePath = this.getLocatorPath(locator, checksum);
      if (!cachePath)
        throw new Error(`Assertion failed: Expected the cache path to be available`);

      let mirrorPathTemp: null | PortablePath = null;
      if (packageSource !== `mirror` && mirrorPath !== null) {
        const tempDir = await xfs.mktempPromise();
        mirrorPathTemp = ppath.join(tempDir, this.getVersionFilename(locator));
        await xfs.copyFilePromise(cachePathTemp, mirrorPathTemp, fs.constants.COPYFILE_FICLONE);
      }

      return await this.writeFileWithLock(cachePath, async () => {
        return await this.writeFileWithLock(packageSource === `mirror` ? null : mirrorPath, async () => {
          // Doing a move is important to ensure atomic writes (todo: cross-drive?)
          await xfs.movePromise(cachePathTemp, cachePath);

          if (mirrorPathTemp && mirrorPath)
            await xfs.movePromise(mirrorPathTemp, mirrorPath);

          return [cachePath, checksum] as const;
        });
      });
    };

    const loadPackageThroughMutex = async () => {
      const mutexedLoad = async () => {
        // We don't yet know whether the cache path can be computed yet, since that
        // depends on whether the cache is actually the mirror or not, and whether
        // the checksum is known or not.
        const tentativeCachePath = this.getLocatorPath(locator, expectedChecksum);

        const cacheExists = tentativeCachePath !== null
          ? await baseFs.existsPromise(tentativeCachePath)
          : false;

        const action = cacheExists
          ? onHit
          : onMiss;

        if (action)
          action();

        if (!cacheExists) {
          return loadPackage();
        } else {
          let checksum: string | null = null;
          const cachePath = tentativeCachePath!;
          if (this.check)
            checksum = await validateFileAgainstRemote(cachePath);
          else
            checksum = await validateFile(cachePath);

          return [cachePath, checksum] as const;
        }
      };

      const mutex = mutexedLoad();
      this.mutexes.set(locator.locatorHash, mutex);

      try {
        return await mutex;
      } finally {
        this.mutexes.delete(locator.locatorHash);
      }
    };

    for (let mutex; (mutex = this.mutexes.get(locator.locatorHash));)
      await mutex;

    const [cachePath, checksum] = await loadPackageThroughMutex();

    this.markedFiles.add(cachePath);

    let zipFs: ZipFS | null = null;

    const libzip = await getLibzipPromise();
    const lazyFs: LazyFS<PortablePath> = new LazyFS<PortablePath>(() => miscUtils.prettifySyncErrors(() => {
      return zipFs = new ZipFS(cachePath, {baseFs, libzip, readOnly: true});
    }, message => {
      return `Failed to open the cache entry for ${structUtils.prettyLocator(this.configuration, locator)}: ${message}`;
    }), ppath);

    // We use an AliasFS to speed up getRealPath calls (e.g. VirtualFetcher.ensureVirtualLink)
    // (there's no need to create the lazy baseFs instance to gather the already-known cachePath)
    const aliasFs = new AliasFS(cachePath, {baseFs: lazyFs, pathUtils: ppath});

    const releaseFs = () => {
      if (zipFs !== null) {
        zipFs.discardAndClose();
      }
    };

    return [aliasFs, releaseFs, checksum];
  }

  private async writeFileWithLock<T>(file: PortablePath | null, generator: () => Promise<T>) {
    if (file === null)
      return await generator();

    return await xfs.lockPromise(file, async () => {
      return await generator();
    });
  }
}

function getCacheKeyComponent(checksum: string) {
  const split = checksum.indexOf(`/`);
  return split !== -1 ? checksum.slice(0, split) : null;
}

function getHashComponent(checksum: string) {
  const split = checksum.indexOf(`/`);
  return split !== -1 ? checksum.slice(split + 1) : checksum;
}
