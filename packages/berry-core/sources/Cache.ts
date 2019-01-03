import {AliasFS, FakeFS, JailFS, NodeFS, ZipFS}  from '@berry/zipfs';
import fsx                                       from 'fs-extra';
import {lock, unlock}                            from 'lockfile';
import {dirname, relative, resolve}              from 'path';
import {promisify}                               from 'util';

import {Configuration}                           from './Configuration';
import {FetchResult}                             from './Fetcher';
import * as structUtils                          from './structUtils';
import {Locator}                                 from './types';

const lockP = promisify(lock);
const unlockP = promisify(unlock);

export class Cache {
  public readonly configuration: Configuration;
  public readonly cwd: string;

  public cacheHitCount: number = 0;
  public cacheMissCount: number = 0;

  static async find(configuration: Configuration) {
    const cacheFolder = configuration.cacheFolder
      ? configuration.cacheFolder
      : ``;

    const cache = new Cache(cacheFolder, {configuration});
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
    await fsx.mkdirp(this.cwd);

    await this.writeFileIntoCache(resolve(this.cwd, `.gitignore`), async (file: string) => {
      await fsx.writeFile(file, `/.gitignore\n*.lock\n`);
    });
  }

  async ensureVirtualLink(locator: Locator, packageFs: FakeFS) {
    const jails = [];

    while (packageFs instanceof JailFS) {
      jails.unshift(packageFs.getTarget());
      packageFs = packageFs.getBaseFs();
    }

    let virtualLink = resolve(this.cwd, `virtual`, this.getCacheKey(locator));

    if (packageFs instanceof ZipFS)
      virtualLink += `.zip`;

    const relativeTarget = relative(dirname(virtualLink), packageFs.getRealPath());

    let currentLink;

    try {
      currentLink = await fsx.readlink(virtualLink);
    } catch (error) {
      if (error.code !== `ENOENT`) {
        throw error;
      }
    }

    if (currentLink !== undefined && currentLink !== relativeTarget)
      throw new Error(`Conflicting virtual paths`);

    if (currentLink === undefined) {
      await fsx.mkdirp(dirname(virtualLink));
      await fsx.symlink(relativeTarget, virtualLink);
    }

    let virtualFs: FakeFS = new AliasFS(virtualLink, {baseFs: packageFs});

    for (const jail of jails)
      virtualFs = new JailFS(jail, {baseFs: virtualFs});

    return virtualFs;
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

        await fsx.chmod(source, 0o644);
        await fsx.move(source, file);
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
