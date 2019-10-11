import {FakeFS, LazyFS, NodeFS, ZipFS, PortablePath, Filename} from '@yarnpkg/fslib';
import {xfs, ppath, toFilename}                                from '@yarnpkg/fslib';

import {Configuration}                                         from './Configuration';
import {MessageName, ReportError}                              from './Report';
import * as hashUtils                                          from './hashUtils';
import * as structUtils                                        from './structUtils';
import {LocatorHash, Locator}                                  from './types';

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

  private mutexes: Map<LocatorHash, Promise<string>> = new Map();

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
  }

  getLocatorFilename(locator: Locator) {
    return `${structUtils.slugifyLocator(locator)}.zip` as Filename;
  }

  getLocatorPath(locator: Locator) {
    return ppath.resolve(this.cwd, this.getLocatorFilename(locator));
  }

  async setup() {
    await xfs.mkdirpPromise(this.cwd);

    const gitignorePath = ppath.resolve(this.cwd, toFilename(`.gitignore`));
    const gitignoreExists = await xfs.existsPromise(gitignorePath);

    if (!gitignoreExists) {
      await xfs.writeFilePromise(gitignorePath, `/.gitignore\n*.lock\n`);
    }
  }

  async fetchPackageFromCache(locator: Locator, expectedChecksum: string | null, loader?: () => Promise<ZipFS>): Promise<[FakeFS<PortablePath>, () => void, string]> {
    const cachePath = this.getLocatorPath(locator);
    const baseFs = new NodeFS();

    this.markedFiles.add(cachePath);

    const validateFile = async (path: PortablePath, refetchPath: PortablePath | null = null) => {
      const actualChecksum = await hashUtils.checksumFile(path);

      if (refetchPath !== null) {
        const previousChecksum = await hashUtils.checksumFile(refetchPath);
        if (actualChecksum !== previousChecksum) {
          throw new ReportError(MessageName.CACHE_CHECKSUM_MISMATCH, `${structUtils.prettyLocator(this.configuration, locator)} doesn't resolve to an archive that matches what's stored in the cache - has the cache been tampered?`);
        }
      }

      if (expectedChecksum !== null && actualChecksum !== expectedChecksum) {
        // Using --check-cache overrides any preconfigured checksum behavior
        const checksumBehavior = !this.check
          ? this.configuration.get(`checksumBehavior`)
          : `throw`;

        switch (checksumBehavior) {
          case `ignore`:
            return expectedChecksum;

          case `update`:
            return actualChecksum;

          default:
          case `throw`: {
            throw new ReportError(MessageName.CACHE_CHECKSUM_MISMATCH, `${structUtils.prettyLocator(this.configuration, locator)} doesn't resolve to an archive that matches the expected checksum`);
          } break;
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

    const loadPackage = async () => {
      if (!loader)
        throw new Error(`Cache entry required but missing for ${structUtils.prettyLocator(this.configuration, locator)}`);
      if (this.immutable)
        throw new ReportError(MessageName.IMMUTABLE_CACHE, `Cache entry required but missing for ${structUtils.prettyLocator(this.configuration, locator)}`);

      return await this.writeFileIntoCache(cachePath, async () => {
        const zipFs = await loader();
        const originalPath = zipFs.getRealPath();

        zipFs.saveAndClose();

        await xfs.chmodPromise(originalPath, 0o644);

        // Do this before moving the file so that we don't pollute the cache with corrupted archives
        const checksum = await validateFile(originalPath);

        // Doing a move is important to ensure atomic writes (todo: cross-drive?)
        await xfs.movePromise(originalPath, cachePath);

        return checksum;
      });
    };

    const loadPackageThroughMutex = async () => {
      const mutex = loadPackage();
      this.mutexes.set(locator.locatorHash, mutex);

      try {
        return await mutex;
      } finally {
        this.mutexes.delete(locator.locatorHash);
      }
    };

    for (let mutex; mutex = this.mutexes.get(locator.locatorHash);)
      await mutex;

    const checksum = !baseFs.existsSync(cachePath)
      ? await loadPackageThroughMutex()
      : this.check
        ? await validateFileAgainstRemote(cachePath)
        : await validateFile(cachePath);

    let zipFs: ZipFS | null = null;

    const lazyFs: LazyFS<PortablePath> = new LazyFS<PortablePath>(() => {
      try {
        return zipFs = new ZipFS(cachePath, {readOnly: true, baseFs});
      } catch (error) {
        error.message = `Failed to open the cache entry for ${structUtils.prettyLocator(this.configuration, locator)}: ${error.message}`;
        throw error;
      }
    }, ppath);

    const releaseFs = () => {
      if (zipFs !== null) {
        zipFs.discardAndClose();
      }
    };

    return [lazyFs, releaseFs, checksum];
  }

  async writeFileIntoCache<T>(file: PortablePath, generator: (file: PortablePath) => Promise<T>) {
    return await xfs.lockPromise<T>(file, async () => {
      return await generator(file);
    });
  }
}
