import {parseSyml}                from '@berry/parsers';
import {existsSync, readFileSync} from 'fs';
import {dirname, resolve}         from 'path';

import {CacheFetcher}             from './CacheFetcher';
import {LockfileResolver}         from './LockfileResolver';
import {MultiFetcher}             from './MultiFetcher';
import {MultiResolver}            from './MultiResolver';
import {Plugin}                   from './Plugin';
import {VirtualFetcher}           from './VirtualFetcher';
import {WorkspaceBaseFetcher}     from './WorkspaceBaseFetcher';
import {WorkspaceBaseResolver}    from './WorkspaceBaseResolver';
import {WorkspaceFetcher}         from './WorkspaceFetcher';
import {WorkspaceResolver}        from './WorkspaceResolver';

const RELATIVE_KEYS = new Set([
  `cache-folder`,
  `pnp-path`,
]);

export class Configuration {
  public projectCwd: string;

  public cacheFolder: string | null = `./.pnp/cache`;

  public registryServer: string | null = null;

  public pnpShebang: string = `#!/usr/bin/env node`;
  public pnpIgnorePattern: string | null = null;
  public pnpVirtualFolder: string = `./.pnp/virtual`;
  public pnpPath: string = `./.pnp.js`;

  public plugins: Map<string, Plugin> = new Map();

  // We store here the source for each settings
  private sources: {[key: string]: string} = {};

  static async find(startingCwd: string, plugins: Map<string, Plugin> = new Map()) {
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

    const configuration = new Configuration(projectCwd, plugins);

    for (const rcCwd of rcCwds)
      configuration.inherits(`${rcCwd}/.berryrc`);
    
    const environmentData: {[key: string]: any} = {};
    const environmentPrefix = `berry_`;

    for (let [key, value] of Object.entries(process.env)) {
      key = key.toLowerCase();

      if (!key.startsWith(environmentPrefix))
        continue;
      
      key = key.slice(environmentPrefix.length);
      key = key.replace(/_([a-z])/g, ($0, $1) => $1.toUpperCase());

      environmentData[key] = value;
    }

    configuration.use(`environment`, environmentData, process.cwd());

    return configuration;
  }

  constructor(projectCwd: string, plugins: Map<string, Plugin>) {
    this.projectCwd = projectCwd;
    this.plugins = plugins;

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

  inherits(source: string) {
    const content = readFileSync(source, `utf8`);
    const data = parseSyml(content);

    this.use(source, data, dirname(source));
  }

  use(source: string, data: {[key: string]: any}, folder: string) {
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

  makeResolver({useLockfile = true}: {useLockfile?: boolean} = {}) {
    const pluginResolvers = [];

    for (const plugin of this.plugins.values())
      for (const resolver of plugin.resolvers || [])
        pluginResolvers.push(resolver);

    return new MultiResolver([
      useLockfile ? new LockfileResolver() : null,
      
      new WorkspaceBaseResolver(),
      new WorkspaceResolver(),

      ... pluginResolvers,
    ]);
  }

  makeFetcher() {
    const getPluginFetchers = (hookName: string) => {
      const fetchers = [];

      for (const plugin of this.plugins.values()) {
        if (!plugin.fetchers)
          continue;

        for (const fetcher of plugin.fetchers) {
          if (fetcher.mountPoint === hookName) {
            fetchers.push(fetcher);
          }
        }
      }

      return fetchers;
    };

    return new MultiFetcher([
      new VirtualFetcher(),

      new WorkspaceBaseFetcher(),
      new WorkspaceFetcher(),

      new MultiFetcher(
        getPluginFetchers(`virtual-fetchers`),
      ),
      
      new CacheFetcher(new MultiFetcher(
        getPluginFetchers(`cached-fetchers`),
      )),
    ]);
  }
}
