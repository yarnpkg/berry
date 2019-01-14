import {FakeFS, JailFS, NodeFS, ZipFS}  from '@berry/zipfs';
import {mkdirp, move}                   from 'fs-extra';
import {chmod, writeFile}               from 'fs';
import {lock, unlock}                   from 'lockfile';
import {resolve}                        from 'path';
import {promisify}                      from 'util';

import {Configuration}                  from './Configuration';
import {FetchResult}                    from './Fetcher';
import * as structUtils                 from './structUtils';
import {Locator}                        from './types';

const chmodP = promisify(chmod);
const writeFileP = promisify(writeFile);

const lockP = promisify(lock);
const unlockP = promisify(unlock);

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
    if (locator.scope) {
      return `@${locator.scope}-${locator.name}-${locator.locatorHash}`;
    } else {
      return `${locator.name}-${locator.locatorHash}`;
    }
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

  async fetchFromCache(locator: Locator, loader?: () => Promise<FetchResult>): Promise<FetchResult> {
    const key = this.getCacheKey(locator);
    const file = this.getFilePath(key);

    const baseFs = new NodeFS();

    return await this.writeFileIntoCache<FetchResult>(file, async () => {
      if (baseFs.existsSync(file)) {
        this.cacheHitCount += 1;
      } else {
        this.cacheMissCount += 1;

        if (!loader)
          throw new Error(`Cache entry required but missing for ${structUtils.prettyLocator(this.configuration, locator)}`);

        const [packageFs, release] = await loader();

        if (!(packageFs instanceof ZipFS))
          throw new Error(`The fetchers plugged into the cache must return a ZipFS instance`);

        const source = packageFs.getRealPath();
        await release();

        await chmodP(source, 0o644);
        await move(source, file);
      }

      let zipFs: ZipFS;
      let packageFs: FakeFS;

      try {
        packageFs = zipFs = new ZipFS(file, {readOnly: true, baseFs});
      } catch (error) {
        error.message = `Failed to open the cache entry for ${structUtils.prettyLocator(this.configuration, locator)}: ${error.message}`;
        throw error;
      }

      if (packageFs.existsSync(`berry-pkg`)) {
        const stat = await packageFs.lstatPromise(`berry-pkg`);

        if (stat.isSymbolicLink()) {
          packageFs = new JailFS(await packageFs.readlinkPromise(`berry-pkg`), {baseFs: packageFs});
        } else {
          packageFs = new JailFS(`berry-pkg`, {baseFs: packageFs});
        }
      }

      return [packageFs, async () => zipFs.close()] as FetchResult;
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
