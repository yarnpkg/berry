import mkdirp = require('mkdirp');

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

const mkdirpP = promisify(mkdirp);

export class Cache {
  public readonly configuration: Configuration;
  public readonly cwd: string;

  static async find(configuration: Configuration) {
    const cacheFolder = configuration.offlineCacheFolder
      ? configuration.offlineCacheFolder
      : ``;

    return new Cache(cacheFolder, {configuration});
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
    await mkdirpP(this.cwd);

    await this.writeFileIntoCache(resolve(this.cwd, `.gitignore`), async (file: string) => {
      await writeFileP(file, `/.gitignore\n*.lock\n`);
    });
  }

  async fetchFromCache(locator: Locator, loader: () => Promise<any>) {
    const key = this.getCacheKey(locator);
    const file = this.getFilePath(key);

    return await this.writeFileIntoCache(file, async () => {
      let archive;

      try {
        archive = await Archive.load(file);
      } catch (error) {
        archive = await loader();
        await archive.store(file);
      }
    });
  }

  async writeFileIntoCache(file: string, generator: (file: string) => any) {
    const lock = `${file}.lock`;

    try {
      await lockP(lock);
    } catch (error) {
      throw new Error(`Couldn't obtain a lock on ${file}`);
    }

    try {
      await generator(file);
      return file;
    } finally {
      await unlockP(lock);
    }
  }
}
