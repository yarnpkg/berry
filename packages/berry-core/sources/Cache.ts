import {FakeFS, LazyFS, NodeFS, ZipFS, PortablePath, Filename} from '@berry/fslib';
import {xfs, ppath, toFilename}                                from '@berry/fslib';

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

  private mutexes: Map<LocatorHash, Promise<string>> = new Map();

  static async find(configuration: Configuration) {
    const cache = new Cache(configuration.get(`cacheFolder`), {configuration});
    await cache.setup();

    return cache;
  }

  constructor(cacheCwd: PortablePath, {configuration}: {configuration: Configuration}) {
    this.configuration = configuration;
    this.cwd = cacheCwd;
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

    const validateFile = async (path: PortablePath) => {
      const actualChecksum = await hashUtils.checksumFile(path);

      if (expectedChecksum !== null && actualChecksum !== expectedChecksum) {
        switch (this.configuration.get(`checksumBehavior`)) {
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

    const loadPackage = async () => {
      if (!loader)
        throw new Error(`Cache entry required but missing for ${structUtils.prettyLocator(this.configuration, locator)}`);

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

    const checksum = baseFs.existsSync(cachePath)
      ? await validateFile(cachePath)
      : await loadPackageThroughMutex();

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
    return await xfs.lockPromise<T>(`${file}.lock` as PortablePath, async () => {
      return await generator(file);
    });
  }
}
