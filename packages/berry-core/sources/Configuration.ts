import {parseSyml}                from '@berry/parsers';
import {existsSync, readFileSync} from 'fs';
import {dirname, resolve}         from 'path';

const RELATIVE_KEYS = new Set([
  `offline-cache-folder`,
  `pnp-path`,
]);

export class Configuration {
  public projectCwd: string;

  public offlineCacheFolder: string | null = `./.pnp/cache`;

  public pnpShebang: string = `/usr/bin/env node`;
  public pnpVirtualFolder: string = `./.pnp/virtual`;
  public pnpPath: string = `./.pnp/.pnp.js`;

  // We store here the source for each settings
  private sources: {[key: string]: string} = {};

  static async find(startingCwd: string) {
    let projectCwd = null;
    const rcCwds = [];

    let nextCwd = startingCwd;
    let currentCwd = null;

    while (nextCwd !== currentCwd) {
      currentCwd = nextCwd;
      if (existsSync(`${currentCwd}/package.json`)) {
        projectCwd = currentCwd;
      }
      if (existsSync(`${currentCwd}/.berryrc`)) {
        rcCwds.push(currentCwd);
      }
      nextCwd = dirname(currentCwd);
    }

    if (!projectCwd)
      throw new Error(`Project not found`);

    const configuration = new Configuration(projectCwd);

    for (const rcCwd of rcCwds)
      await configuration.inherits(`${rcCwd}/.berryrc`);

    return configuration;
  }

  constructor(projectCwd: string) {
    this.projectCwd = projectCwd;

    for (const key of RELATIVE_KEYS) {
      const name = key.replace(/-([a-z])/g, ($0, $1) => $1.toUpperCase());

      // @ts-ignore
      let value = this[name];

      if (!value)
        continue;

      // @ts-ignore
      this[name] = resolve(projectCwd, value);
    }
  }

  async inherits(source: string) {
    const folder = dirname(source);

    const content = readFileSync(source, `utf8`);
    const data = parseSyml(content);

    for (const key of Object.keys(data)) {
      const name = key.replace(/-([a-z])/g, ($0, $1) => $1.toUpperCase());

      if (Object.prototype.hasOwnProperty.call(this.sources, name))
        continue;

      // @ts-ignore
      let value = data[key];

      if (RELATIVE_KEYS.has(key))
        value = resolve(folder, value);

      if (!Object.prototype.hasOwnProperty.call(this, name))
        throw new Error(`Unknown configuration option "${key}"`);

      // @ts-ignore
      this[name] = value;

      this.sources[name] = source;
    }
  }
};
