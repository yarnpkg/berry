import {parseSyml, stringifySyml}        from '@berry/parsers';
import chalk                             from 'chalk';
import {existsSync, readFile, writeFile} from 'fs';
import {dirname, resolve}                from 'path';
import supportsColor                     from 'supports-color';
import {promisify}                       from 'util';

import {CacheFetcher}                    from './CacheFetcher';
import {MultiFetcher}                    from './MultiFetcher';
import {MultiResolver}                   from './MultiResolver';
import {Plugin}                          from './Plugin';
import {SemverResolver}                  from './SemverResolver';
import {TagResolver}                     from './TagResolver';
import {VirtualFetcher}                  from './VirtualFetcher';
import {WorkspaceFetcher}                from './WorkspaceFetcher';
import {WorkspaceResolver}               from './WorkspaceResolver';

// @ts-ignore
const ctx: any = new chalk.constructor({enabled: true});

const readFileP = promisify(readFile);
const writeFileP = promisify(writeFile);

// The keys defined in this array will be resolved and normalized relative to
// the path of their source configuration (usually the .berryrc directory)
const RELATIVE_KEYS = new Set([
  `bstate-path`,
  `cache-folder`,
  `pnp-path`,
  `pnp-unplugged-folder`,
]);

// The keys defined here will be casted into booleans (and will throw an error
// if the value cannot be safely coerced into a boolean)
const BOOLEAN_KEYS = new Set([
  `enable-colors`,
  `enable-emojis`,
  `enable-scripts`,
  `ignore-path`,
]);

function parseBoolean(value: string) {
  switch (value) {
    case `true`:
    case `1`: {
      return true;
    } break;

    case `false`:
    case `0`: {
      return false;
    } break;

    default: {
      throw new Error(`Invalid value`);
    } break;
  }
}

export class Configuration {
  // General rules:
  //
  // - filenames that don't accept actual paths must end with the "Name" suffix
  //   ex: lockfileName
  //
  // - folders must end with the "Folder" suffix
  //   ex: cacheFolder, pnpVirtualFolder
  //
  // - actual paths to a file must end with the "Path" suffix
  //   ex: pnpPath
  //
  // - options that tweaks the strictness must begin with the "allow" prefix
  //   ex: allowInvalidChecksums
  //
  // - options that enable a feature must begin with the "enable" prefix
  //   ex: enableEmojis, enableColors

  // Should not be manually set - detected automatically
  public plugins: Map<string, Plugin> = new Map();

  // Should not be manually set - detected automatically
  public projectCwd: string;

  // Should not be manually set - computed automatically
  private sources: {[key: string]: string} = {};

  // Settings related to the proxying Berry to a specific executable
  public executablePath: string | null = null;
  public ignorePath: boolean = false;

  // Settings related to the package manager internal names
  public lockfileName: string = `berry.lock`;
  public cacheFolder: string | null = `./.berry/cache`;
  public bstatePath: string = `./.berry/buildState.json`;

  // Settings related to the output style
  public enableEmojis: boolean = !!supportsColor.stdout;
  public enableColors: boolean = !!supportsColor.stdout;

  // Settings related to how packages are interpreted by default
  public defaultLanguageName: string = `node`;
  public defaultProtocol: string = `npm:`;

  // Settings related to network proxies
  public httpProxy: string | null = null;
  public httpsProxy: string | null = null;

  // Settings related to the registry used to resolve semver requests
  public registryServer: string | null = null;

  // Settings related to PnP
  public pnpShebang: string = `#!/usr/bin/env node`;
  public pnpIgnorePattern: string | null = null;
  public pnpUnpluggedFolder: string = `./.berry/pnp/unplugged`;
  public pnpPath: string = `./.pnp.js`;

  // Settings related to security
  public enableScripts: boolean = true;

  static async find(startingCwd: string, plugins: Map<string, Plugin> = new Map()) {
    let projectCwd = null;
    const rcCwds = [];

    let nextCwd = startingCwd;
    let currentCwd = null;

    while (nextCwd !== currentCwd) {
      currentCwd = nextCwd;

      if (existsSync(`${currentCwd}/package.json`))
        projectCwd = currentCwd;

      if (existsSync(`${currentCwd}/.berryrc`))
        rcCwds.push(currentCwd);

      nextCwd = dirname(currentCwd);
    }

    if (!projectCwd)
      throw new Error(`Project not found`);

    const configuration = new Configuration(projectCwd, plugins);

    for (const rcCwd of rcCwds)
      await configuration.inherits(`${rcCwd}/.berryrc`);

    const environmentData: {[key: string]: any} = {};
    const environmentPrefix = `berry_`;

    for (let [key, value] of Object.entries(process.env)) {
      key = key.toLowerCase();

      if (!key.startsWith(environmentPrefix))
        continue;

      key = key.slice(environmentPrefix.length);

      environmentData[key] = value;
    }

    configuration.use(`environment`, environmentData, process.cwd());

    return configuration;
  }

  static async updateConfiguration(cwd: string, patch: any) {
    const configurationPath = `${cwd}/.berryrc`;

    const current = existsSync(configurationPath)
      ? parseSyml(await readFileP(configurationPath, `utf8`)) as any
      : {};

    let patched = false;

    for (const key of Object.keys(patch)) {
      if (current[key] === patch[key])
        continue;

      current[key] = patch[key];
      patched = true;
    }

    if (!patched)
      return;

    await writeFileP(configurationPath, stringifySyml(current));
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

  async inherits(source: string) {
    const content = await readFileP(source, `utf8`);
    const data = parseSyml(content);

    this.use(source, data, dirname(source));
  }

  use(source: string, data: {[key: string]: any}, folder: string) {
    for (const key of Object.keys(data)) {
      const name = key.replace(/[_-]([a-z])/g, ($0, $1) => $1.toUpperCase());

      if (Object.prototype.hasOwnProperty.call(this.sources, name))
        continue;

      // @ts-ignore
      let value = data[key];

      if (RELATIVE_KEYS.has(key))
        value = resolve(folder, value);
      
      if (BOOLEAN_KEYS.has(key) && typeof value === `string`)
        value = parseBoolean(value);

      if (!Object.prototype.hasOwnProperty.call(this, name))
        throw new Error(`Unknown configuration option "${key}"`);

      // @ts-ignore
      this[name] = value;

      this.sources[name] = source;
    }
  }

  makeResolver() {
    const pluginResolvers = [];

    for (const plugin of this.plugins.values())
      for (const resolver of plugin.resolvers || [])
        pluginResolvers.push(new resolver());

    return new MultiResolver([
      new WorkspaceResolver(),
      new SemverResolver(),
      new TagResolver(),

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
            fetchers.push(new fetcher());
          }
        }
      }

      return fetchers;
    };

    return new MultiFetcher([
      new VirtualFetcher(),
      new WorkspaceFetcher(),

      new MultiFetcher(
        getPluginFetchers(`virtual-fetchers`),
      ),

      new CacheFetcher(new MultiFetcher(
        getPluginFetchers(`cached-fetchers`),
      )),
    ]);
  }

  getLinkers() {
    const linkers = [];

    for (const plugin of this.plugins.values())
      for (const linker of plugin.linkers || [])
        linkers.push(new linker());

    return linkers;
  }

  format(text: string, color: string) {
    if (this.enableColors) {
      if (color.charAt(0) === `#`) {
        return ctx.hex(color)(text);
      } else {
        return ctx[color](text);
      }
    } else {
      return text;
    }
  }
}
