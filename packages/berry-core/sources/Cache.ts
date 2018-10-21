import fsx = require('fs-extra');

import {FakeFS, ZipFS, NodeFS}      from '@berry/zipfs';
import {createHmac}                 from 'crypto';
import {writeFile}                  from 'fs';
import {lock, unlock}               from 'lockfile';
import {dirname, relative, resolve} from 'path';
import {promisify}                  from 'util';

import {Archive}                    from './Archive';
import {Configuration}              from './Configuration';
import {Locator}                    from './types';

const writeFileP = promisify(writeFile);

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

  getCacheKey({scope, name, reference}: Locator) {
    const hash = createHmac(`sha256`, `berry`)
      .update(JSON.stringify({scope, name, reference}))
      .digest(`hex`)
      .substr(0, 16);

    if (scope) {
      return `@${scope}-${name}-${hash}`;
    } else {
      return `${name}-${hash}`;
    }
  }

  getFilePath(key: string) {
    return resolve(this.cwd, `${key}.zip`);
  }

  async setup() {
    await fsx.mkdirp(this.cwd);

    await this.writeFileIntoCache(resolve(this.cwd, `.gitignore`), async (file: string) => {
      await writeFileP(file, `/.gitignore\n*.lock\n`);
    });
  }

  async ensureVirtualLink(locator: Locator, target: string) {
    const virtualLink = resolve(this.cwd, `virtual`, locator.locatorHash);

    // @ts-ignore: [DefinitelyTyped] The "type" parameter is missing
    await fsx.ensureSymlink(relative(dirname(virtualLink), target), virtualLink);

    return virtualLink;
  }

  async fetchFromCache(locator: Locator, loader?: () => Promise<FakeFS>) {
    const key = this.getCacheKey(locator);
    const file = this.getFilePath(key);

    return await this.writeFileIntoCache<FakeFS>(file, async () => {
      let fs;

      try {
        fs = new ZipFS(file, {baseFs: new NodeFS()});
        this.cacheHitCount += 1;
      } catch (error) {
        this.cacheMissCount += 1;

        if (!loader)
          throw error;

        fs = await loader();

        if (!(fs instanceof ZipFS))
          throw new Error(`The fetchers plugged into the cache must return a ZipFS instance`);

        const source = fs.close();

        await fsx.chmod(source, 0o644);
        await fsx.move(source, file);

        fs = new ZipFS(file);
      }

      return fs;
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
