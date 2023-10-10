import {formatUtils}                                             from '@yarnpkg/core';
import {FakeFS, LazyFS, NodeFS, PortablePath, Filename, AliasFS} from '@yarnpkg/fslib';
import {ppath, xfs}                                              from '@yarnpkg/fslib';
import {ZipFS}                                                   from '@yarnpkg/libzip';
import {randomBytes}                                             from 'crypto';
import fs                                                        from 'fs';

import {Configuration}                                           from './Configuration';
import {MessageName}                                             from './MessageName';
import {ReportError}                                             from './Report';
import * as hashUtils                                            from './hashUtils';
import * as miscUtils                                            from './miscUtils';
import * as structUtils                                          from './structUtils';
import {LocatorHash, Locator}                                    from './types';

/**
 * If value defines the minimal cache version we can read files from. We need
 * to bump this value every time we fix a bug in the cache implementation that
 * causes the archived content to change.
 */
export const CACHE_CHECKPOINT = miscUtils.parseInt(
  process.env.YARN_CACHE_CHECKPOINT_OVERRIDE ??
  process.env.YARN_CACHE_VERSION_OVERRIDE ??
  9,
);

/**
 * The cache version, on the other hand, is meant to be bumped every time we
 * change the archives in any way (for example when upgrading the libzip or zlib
 * implementations in ways that would change the exact bytes). This way we can
 * avoid refetching the archives when their content hasn't actually changed in
 * a significant way.
 */
export const CACHE_VERSION = miscUtils.parseInt(
  process.env.YARN_CACHE_VERSION_OVERRIDE ??
  10,
);

export type CacheOptions = {
  mockedPackages?: Set<LocatorHash>;
  unstablePackages?: Set<LocatorHash>;

  mirrorWriteOnly?: boolean;
  skipIntegrityCheck?: boolean;
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
  public readonly cacheSpec: string;

  private mutexes: Map<LocatorHash, Promise<readonly [
    shouldMock: boolean,
    cachePath: PortablePath,
    checksum: string | null,
  ]>> = new Map();

  /**
   * To ensure different instances of `Cache` doesn't end up copying to the same
   * temporary file this random ID is appended to the filename.
   */
  private cacheId = `-${randomBytes(8).toString(`hex`)}.tmp`;

  static async find(configuration: Configuration, {immutable, check}: {immutable?: boolean, check?: boolean} = {}) {
    const cache = new Cache(configuration.get(`cacheFolder`), {configuration, immutable, check});
    await cache.setup();

    return cache;
  }

  static getCacheKey(configuration: Configuration) {
    const compressionLevel = configuration.get(`compressionLevel`);

    const cacheSpec = compressionLevel !== `mixed`
      ? `c${compressionLevel}`
      : ``;

    const cacheKey = [
      CACHE_VERSION,
      cacheSpec,
    ].join(``);

    return {
      cacheKey,
      cacheSpec,
    };
  }

  constructor(cacheCwd: PortablePath, {configuration, immutable = configuration.get(`enableImmutableCache`), check = false}: {configuration: Configuration, immutable?: boolean, check?: boolean}) {
    this.configuration = configuration;
    this.cwd = cacheCwd;

    this.immutable = immutable;
    this.check = check;

    const {
      cacheSpec,
      cacheKey,
    } = Cache.getCacheKey(configuration);

    this.cacheSpec = cacheSpec;
    this.cacheKey = cacheKey;
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
    const contentChecksum = splitChecksumComponents(checksum).hash;

    // We only care about the first few characters. It doesn't matter if that
    // makes the hash easier to collide with, because we check the file hashes
    // during each install anyway.
    const significantChecksum = contentChecksum.slice(0, 10);

    return `${structUtils.slugifyLocator(locator)}-${significantChecksum}.zip` as Filename;
  }

  isChecksumCompatible(checksum: string) {
    // If we don't yet know the checksum, discard the path resolution for now
    // until the checksum can be obtained from somewhere (mirror or network).
    if (checksum === null)
      return false;

    const {
      cacheVersion,
      cacheSpec,
    } = splitChecksumComponents(checksum);

    if (cacheVersion === null)
      return false;

    // The cache keys must always be at least as old as the last checkpoint.
    if (cacheVersion < CACHE_CHECKPOINT)
      return false;

    const migrationMode = this.configuration.get(`cacheMigrationMode`);

    // If the global cache is used, then the lockfile must always be up-to-date,
    // so the archives must be regenerated each time the version changes.
    if (cacheVersion < CACHE_VERSION && migrationMode === `always`)
      return false;

    // If the cache spec changed, we may need to regenerate the archive
    if (cacheSpec !== this.cacheSpec && migrationMode !== `required-only`)
      return false;

    return true;
  }

  getLocatorPath(locator: Locator, expectedChecksum: string | null) {
    // When using the global cache we want the archives to be named as per
    // the cache key rather than the hash, as otherwise we wouldn't be able
    // to find them if we didn't have the hash (which is the case when adding
    // new dependencies to a project).
    if (this.mirrorCwd === null)
      return ppath.resolve(this.cwd, this.getVersionFilename(locator));

    // Same thing if we don't know the checksum; it means that the package
    // doesn't support being checksum'd (unstablePackage), so we fallback
    // on the versioned filename.
    if (expectedChecksum === null)
      return ppath.resolve(this.cwd, this.getVersionFilename(locator));

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

        const gitignorePath = ppath.resolve(this.cwd, `.gitignore`);

        await xfs.changeFilePromise(gitignorePath, `/.gitignore\n*.flock\n*.tmp\n`);
      }
    }

    if (this.mirrorCwd || !this.immutable) {
      await xfs.mkdirPromise(this.mirrorCwd || this.cwd, {recursive: true});
    }
  }

  async fetchPackageFromCache(locator: Locator, expectedChecksum: string | null, {onHit, onMiss, loader, ...opts}: {onHit?: () => void, onMiss?: () => void, loader?: () => Promise<ZipFS> } & CacheOptions): Promise<[FakeFS<PortablePath>, () => void, string | null]> {
    const mirrorPath = this.getLocatorMirrorPath(locator);

    const baseFs = new NodeFS();

    // Conditional packages may not be fetched if they're intended for a
    // different architecture than the current one. To avoid having to be
    // careful about those packages everywhere, we instead change their
    // content to that of an empty in-memory package.
    //
    // This memory representation will be wrapped into an AliasFS to make
    // it seem like it actually exist on the disk, at the location of the
    // cache the package would fill if it was normally fetched.
    const makeMockPackage = () => {
      const zipFs = new ZipFS();

      const rootPackageDir = ppath.join(PortablePath.root, structUtils.getIdentVendorPath(locator));
      zipFs.mkdirSync(rootPackageDir, {recursive: true});
      zipFs.writeJsonSync(ppath.join(rootPackageDir, Filename.manifest), {
        name: structUtils.stringifyIdent(locator),
        mocked: true,
      });

      return zipFs;
    };

    type ValidateFileOptions = {
      /**
       * True if the file was generated from scratch. Useful to persist
       * potentially outdated cache key.
       */
      isColdHit: boolean;

      /**
       * Path to a file who will also be checksumed and compared to the
       * expected checksum. We use this when pulling a value from the remote
       * registry and comparing that what we have (including the checksum)
       * matches what we just pulled.
       */
      controlPath?: PortablePath | null;
    };

    const validateFile = async (path: PortablePath, {isColdHit, controlPath = null}: ValidateFileOptions): Promise<{isValid: boolean, hash: string | null}> => {
      // We hide the checksum if the package presence is conditional, because it becomes unreliable
      // so there is no point in computing it unless we're checking the cache
      if (controlPath === null && opts.unstablePackages?.has(locator.locatorHash))
        return {isValid: true, hash: null};

      const actualCacheKey = expectedChecksum && !isColdHit
        ? splitChecksumComponents(expectedChecksum).cacheKey
        : this.cacheKey;

      const actualChecksum = (!opts.skipIntegrityCheck || !expectedChecksum)
        ? `${actualCacheKey}/${await hashUtils.checksumFile(path)}`
        : expectedChecksum;

      if (controlPath !== null) {
        const previousChecksum = (!opts.skipIntegrityCheck || !expectedChecksum)
          ? `${this.cacheKey}/${await hashUtils.checksumFile(controlPath)}`
          : expectedChecksum;

        if (actualChecksum !== previousChecksum) {
          throw new ReportError(MessageName.CACHE_CHECKSUM_MISMATCH, `The remote archive doesn't match the local checksum - has the local cache been corrupted?`);
        }
      }

      let checksumBehavior: string | null = null;

      if (expectedChecksum !== null && actualChecksum !== expectedChecksum) {
        // Using --check-cache overrides any preconfigured checksum behavior
        if (this.check) {
          checksumBehavior = `throw`;
        // If the lockfile references an old cache format, we tolerate different checksums
        } else if (splitChecksumComponents(expectedChecksum).cacheKey !== splitChecksumComponents(actualChecksum).cacheKey) {
          checksumBehavior = `update`;
        } else {
          checksumBehavior = this.configuration.get(`checksumBehavior`);
        }
      }

      switch (checksumBehavior) {
        case null:
        case `update`:
          return {isValid: true, hash: actualChecksum};

        case `ignore`:
          return {isValid: true, hash: expectedChecksum};

        case `reset`:
          return {isValid: false, hash: expectedChecksum};

        default:
        case `throw`: {
          throw new ReportError(MessageName.CACHE_CHECKSUM_MISMATCH, `The remote archive doesn't match the expected checksum`);
        }
      }
    };

    const validateFileAgainstRemote = async (cachePath: PortablePath) => {
      if (!loader)
        throw new Error(`Cache check required but no loader configured for ${structUtils.prettyLocator(this.configuration, locator)}`);

      const zipFs = await loader();
      const controlPath = zipFs.getRealPath();

      zipFs.saveAndClose();

      await xfs.chmodPromise(controlPath, 0o644);

      const result = await validateFile(cachePath, {
        controlPath,
        isColdHit: false,
      });

      if (!result.isValid)
        throw new Error(`Assertion failed: Expected a valid checksum`);

      return result.hash;
    };

    const loadPackageThroughMirror = async () => {
      if (mirrorPath === null || !(await xfs.existsPromise(mirrorPath))) {
        const zipFs = await loader!();
        const realPath = zipFs.getRealPath();
        zipFs.saveAndClose();
        return {source: `loader`, path: realPath} as const;
      }

      return {source: `mirror`, path: mirrorPath} as const;
    };

    const loadPackage = async () => {
      if (!loader)
        throw new Error(`Cache entry required but missing for ${structUtils.prettyLocator(this.configuration, locator)}`);

      if (this.immutable)
        throw new ReportError(MessageName.IMMUTABLE_CACHE, `Cache entry required but missing for ${structUtils.prettyLocator(this.configuration, locator)}`);

      const {path: packagePath, source: packageSource} = await loadPackageThroughMirror();

      // Do this before moving the file so that we don't pollute the cache with corrupted archives
      const {hash: checksum} = await validateFile(packagePath, {
        isColdHit: true,
      });

      const cachePath = this.getLocatorPath(locator, checksum);
      const copyProcess: Array<() => Promise<void>> = [];

      // Copy the package into the mirror
      if (packageSource !== `mirror` && mirrorPath !== null) {
        copyProcess.push(async () => {
          const mirrorPathTemp = `${mirrorPath}${this.cacheId}` as PortablePath;
          await xfs.copyFilePromise(packagePath, mirrorPathTemp, fs.constants.COPYFILE_FICLONE);
          await xfs.chmodPromise(mirrorPathTemp, 0o644);
          // Doing a rename is important to ensure the cache is atomic
          await xfs.renamePromise(mirrorPathTemp, mirrorPath);
        });
      }

      // Copy the package into the cache
      if (!opts.mirrorWriteOnly || mirrorPath === null) {
        copyProcess.push(async () => {
          const cachePathTemp = `${cachePath}${this.cacheId}` as PortablePath;
          await xfs.copyFilePromise(packagePath, cachePathTemp, fs.constants.COPYFILE_FICLONE);
          await xfs.chmodPromise(cachePathTemp, 0o644);
          // Doing a rename is important to ensure the cache is atomic
          await xfs.renamePromise(cachePathTemp, cachePath);
        });
      }

      const finalPath = opts.mirrorWriteOnly
        ? mirrorPath ?? cachePath
        : cachePath;

      await Promise.all(copyProcess.map(copy => copy()));

      return [false, finalPath, checksum] as const;
    };

    const loadPackageThroughMutex = async () => {
      const mutexedLoad = async () => {
        const isUnstablePackage = opts.unstablePackages?.has(locator.locatorHash);

        const tentativeCachePath = isUnstablePackage || !expectedChecksum || this.isChecksumCompatible(expectedChecksum)
          ? this.getLocatorPath(locator, expectedChecksum)
          : null;

        const cacheFileExists = tentativeCachePath !== null
          ? this.markedFiles.has(tentativeCachePath) || await baseFs.existsPromise(tentativeCachePath)
          : false;

        const shouldMock = !!opts.mockedPackages?.has(locator.locatorHash) && (!this.check || !cacheFileExists);
        const isCacheHit = shouldMock || cacheFileExists;

        const action = isCacheHit
          ? onHit
          : onMiss;

        if (action)
          action();

        if (!isCacheHit) {
          if (this.immutable && isUnstablePackage)
            throw new ReportError(MessageName.IMMUTABLE_CACHE, `Cache entry required but missing for ${structUtils.prettyLocator(this.configuration, locator)}; consider defining ${formatUtils.pretty(this.configuration, `supportedArchitectures`, formatUtils.Type.CODE)} to cache packages for multiple systems`);

          return loadPackage();
        } else {
          let checksum: string | null = null;
          const cachePath = tentativeCachePath!;
          if (!shouldMock) {
            if (this.check) {
              checksum = await validateFileAgainstRemote(cachePath);
            } else {
              const maybeChecksum = await validateFile(cachePath, {
                isColdHit: false,
              });

              if (maybeChecksum.isValid) {
                checksum = maybeChecksum.hash;
              } else {
                return loadPackage();
              }
            }
          }

          return [shouldMock, cachePath, checksum] as const;
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

    const [shouldMock, cachePath, checksum] = await loadPackageThroughMutex();

    if (!shouldMock)
      this.markedFiles.add(cachePath);

    let zipFs: ZipFS | undefined;

    const zipFsBuilder = shouldMock
      ? () => makeMockPackage()
      : () => new ZipFS(cachePath, {baseFs, readOnly: true});

    const lazyFs = new LazyFS<PortablePath>(() => miscUtils.prettifySyncErrors(() => {
      return zipFs = zipFsBuilder();
    }, message => {
      return `Failed to open the cache entry for ${structUtils.prettyLocator(this.configuration, locator)}: ${message}`;
    }), ppath);

    // We use an AliasFS to speed up getRealPath calls (e.g. VirtualFetcher.ensureVirtualLink)
    // (there's no need to create the lazy baseFs instance to gather the already-known cachePath)
    const aliasFs = new AliasFS(cachePath, {baseFs: lazyFs, pathUtils: ppath});

    const releaseFs = () => {
      zipFs?.discardAndClose();
    };

    // We hide the checksum if the package presence is conditional, because it becomes unreliable
    const exposedChecksum = !opts.unstablePackages?.has(locator.locatorHash)
      ? checksum
      : null;

    return [aliasFs, releaseFs, exposedChecksum];
  }
}

const CHECKSUM_REGEX = /^(?:(?<cacheKey>(?<cacheVersion>[0-9]+)(?<cacheSpec>.*))\/)?(?<hash>.*)$/;

function splitChecksumComponents(checksum: string) {
  const match = checksum.match(CHECKSUM_REGEX);
  if (!match?.groups)
    throw new Error(`Assertion failed: Expected the checksum to match the requested pattern`);

  const cacheVersion = match.groups.cacheVersion
    ? parseInt(match.groups.cacheVersion)
    : null;

  return {
    cacheKey: match.groups.cacheKey ?? null,
    cacheVersion,
    cacheSpec: match.groups.cacheSpec ?? null,
    hash: match.groups.hash,
  };
}
