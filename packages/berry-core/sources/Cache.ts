import {NodeFS, ZipFS}            from '@berry/zipfs';
import {mkdirp, move}             from 'fs-extra';
import {chmod, writeFile}         from 'fs';
import {lock, unlock}             from 'lockfile';
import {resolve}                  from 'path';
import semver                     from 'semver';
import {promisify}                from 'util';

import {Configuration}            from './Configuration';
import {MessageName, ReportError} from './Report';
import * as hashUtils             from './hashUtils';
import * as structUtils           from './structUtils';
import {LocatorHash, Locator}     from './types';

const chmodP = promisify(chmod);
const writeFileP = promisify(writeFile);

const lockP = promisify(lock);
const unlockP = promisify(unlock);

export type FetchFromCacheOptions = {
  checksums: Map<LocatorHash, Locator>,
};

export class Cache {
  public readonly configuration: Configuration;
  public readonly cwd: string;

  public cacheHitCount: number = 0;
  public cacheMissCount: number = 0;

  static async find(configuration: Configuration) {
    const cache = new Cache(configuration.cacheFolder, {configuration});
    await cache.setup();

    return cache;
  }

  constructor(cacheCwd: string, {configuration}: {configuration: Configuration}) {
    this.configuration = configuration;
    this.cwd = cacheCwd;
  }

  getCacheKey(locator: Locator) {
    const protocolIndex = locator.reference.indexOf(`:`);

    const protocol = protocolIndex !== -1
      ? locator.reference.slice(0, protocolIndex)
      : `exotic`;

    const version = protocolIndex !== -1
      ? semver.valid(locator.reference.slice(protocolIndex + 1))
      : null;
    
    const humanReference = version !== null
      ? `${protocol}-${version}`
      : protocol;

    const cacheKey = locator.scope
      ? `@${locator.scope}-${locator.name}-${humanReference}-${locator.locatorHash}`
      : `${locator.name}-${humanReference}-${locator.locatorHash}`;
    
    return cacheKey;
  }

  getFilePath(key: string) {
    return resolve(this.cwd, `${key}.zip`);
  }

  async setup() {
    await mkdirp(this.cwd);

    await this.writeFileIntoCache(resolve(this.cwd, `.gitignore`), async (file: string) => {
      await writeFileP(file, `/.gitignore\n*.lock\n`);
    });
  }

  async fetchPackageFromCache(locator: Locator, checksum: string | null, loader?: () => Promise<ZipFS>): Promise<[ZipFS, string]> {
    const key = this.getCacheKey(locator);
    const cachePath = this.getFilePath(key);

    const baseFs = new NodeFS();

    const validateFile = async (path: string) => {
      const expectedChecksum = checksum;
      const actualChecksum = await hashUtils.checksumFile(path);

      if (expectedChecksum !== null && actualChecksum !== expectedChecksum)
        throw new ReportError(MessageName.CACHE_CHECKSUM_MISMATCH, `${structUtils.prettyLocator(this.configuration, locator)} doesn't resolve to an archive that matches the expected checksum`);
      
      return actualChecksum;
    };

    return await this.writeFileIntoCache<[ZipFS, string]>(cachePath, async () => {
      let checksum;

      if (baseFs.existsSync(cachePath)) {
        this.cacheHitCount += 1;

        checksum = await validateFile(cachePath);
      } else {
        this.cacheMissCount += 1;

        if (!loader)
          throw new Error(`Cache entry required but missing for ${structUtils.prettyLocator(this.configuration, locator)}`);

        const zipFs = await loader();
        const originalPath = zipFs.getRealPath();

        zipFs.close();

        await chmodP(originalPath, 0o644);

        // Do this before moving the file so that we don't pollute the cache with corrupted archives
        checksum = await validateFile(originalPath);

        await move(originalPath, cachePath);
      }

      let zipFs: ZipFS;

      try {
        zipFs = new ZipFS(cachePath, {readOnly: true, baseFs});
      } catch (error) {
        error.message = `Failed to open the cache entry for ${structUtils.prettyLocator(this.configuration, locator)}: ${error.message}`;
        throw error;
      }

      return [zipFs, checksum];
    });
  }

  async writeFileIntoCache<T>(file: string, generator: (file: string) => Promise<T>) {
    const lock = `${file}.lock`;

    try {
      await lockP(lock);
    } catch (error) {
      throw new Error(`Couldn't obtain a lock on ${file}`);
    }

    try {
      return await generator(file);
    } finally {
      await unlockP(lock);
    }
  }
}
