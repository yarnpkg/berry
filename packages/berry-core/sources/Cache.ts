import fsx = require('fs-extra');

import {createHmac}    from 'crypto';
import {writeFile}     from 'fs';
import {lock, unlock}  from 'lockfile';
import {resolve}       from 'path';
import {promisify}     from 'util';

import {Archive}       from './Archive';
import {Configuration} from './Configuration';
import {Locator}       from './types';

const writeFileP = promisify(writeFile);

const lockP = promisify(lock);
const unlockP = promisify(unlock);

export class Cache {
  public readonly configuration: Configuration;
  public readonly cwd: string;

  public cacheHitCount: number = 0;
  public cacheMissCount: number = 0;

  static async find(configuration: Configuration) {
    const cacheFolder = configuration.offlineCacheFolder
      ? configuration.offlineCacheFolder
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

  async fetchVirtualFolder(locator: Locator) {
    const virtualFolder = resolve(this.cwd, `virtual`, locator.locatorHash);

    // @ts-ignore: [DefinitelyTyped] The "type" parameter is missing
    await fsx.ensureSymlink(`/`, virtualFolder, `junction`);

    return virtualFolder;
  }

  async fetchFromCache(locator: Locator, loader?: () => Promise<Archive>) {
    const key = this.getCacheKey(locator);
    const file = this.getFilePath(key);

    return await this.writeFileIntoCache(file, async () => {
      let archive;

      try {
        archive = await Archive.load(file);
        this.cacheHitCount += 1;
      } catch (error) {
        this.cacheMissCount += 1;

        if (!loader)
          throw error;

        archive = await loader();
        await archive.store(file);
      }

      return archive;
    });
  }

  async writeFileIntoCache<T>(file: string, generator: (file: string) => Promise<T>) {
    const lock = `${file}.lock`;

    try {
      await lockP(lock);
    } catch (error) {
      throw new Error(`Couldn't obtain a lock on ${file}`);
    }

    let entity: T;

    try {
      entity = await generator(file);
    } finally {
      await unlockP(lock);
    }

    return {file, entity};
  }
}
