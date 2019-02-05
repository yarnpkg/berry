import {NodeFS, ZipFS, xfs}       from '@berry/fslib';
import {lock, unlock}             from 'lockfile';
import {resolve}                  from 'path';
import {promisify}                from 'util';

import {Configuration}            from './Configuration';
import {MessageName, ReportError} from './Report';
import * as hashUtils             from './hashUtils';
import * as structUtils           from './structUtils';
import {LocatorHash, Locator}     from './types';

const lockP = promisify(lock);
const unlockP = promisify(unlock);

export type FetchFromCacheOptions = {
  checksums: Map<LocatorHash, Locator>,
};

export class Cache {
  public readonly configuration: Configuration;
  public readonly cwd: string;

  private mutexes: Map<LocatorHash, Promise<string>> = new Map();

  static async find(configuration: Configuration) {
    const cache = new Cache(configuration.get(`cacheFolder`), {configuration});
    await cache.setup();

    return cache;
  }

  constructor(cacheCwd: string, {configuration}: {configuration: Configuration}) {
    this.configuration = configuration;
    this.cwd = cacheCwd;
  }

  getCacheKey(locator: Locator) {
    return structUtils.slugifyLocator(locator);
  }

  getFilePath(key: string) {
    return resolve(this.cwd, `${key}.zip`);
  }

  getLocatorPath(locator: Locator) {
    return this.getFilePath(this.getCacheKey(locator));
  }

  async setup() {
    await xfs.mkdirpPromise(this.cwd);

    await this.writeFileIntoCache(resolve(this.cwd, `.gitignore`), async (file: string) => {
      await xfs.writeFilePromise(file, `/.gitignore\n*.lock\n`);
    });
  }

  async fetchPackageFromCache(locator: Locator, expectedChecksum: string | null, loader?: () => Promise<ZipFS>): Promise<[ZipFS, string]> {
    const cachePath = this.getLocatorPath(locator);
    const baseFs = new NodeFS();

    const validateFile = async (path: string) => {
      const actualChecksum = await hashUtils.checksumFile(path);

      if (expectedChecksum !== null && actualChecksum !== expectedChecksum)
        throw new ReportError(MessageName.CACHE_CHECKSUM_MISMATCH, `${structUtils.prettyLocator(this.configuration, locator)} doesn't resolve to an archive that matches the expected checksum`);
      
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

    let zipFs: ZipFS;
    try {
      zipFs = new ZipFS(cachePath, {readOnly: true, baseFs});
    } catch (error) {
      error.message = `Failed to open the cache entry for ${structUtils.prettyLocator(this.configuration, locator)}: ${error.message}`;
      throw error;
    }

    return [zipFs, checksum];
  }

  async writeFileIntoCache<T>(file: string, generator: (file: string) => Promise<T>) {
    const lock = `${file}.lock`;

    try {
      await lockP(lock);
    } catch (error) {
      throw new Error(`Couldn't obtain a lock on ${file} (${error.message})`);
    }

    try {
      return await generator(file);
    } finally {
      await unlockP(lock);
    }
  }
}
