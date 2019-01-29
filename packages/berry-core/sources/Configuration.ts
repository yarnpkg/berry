import {parseSyml, stringifySyml}        from '@berry/parsers';
import chalk                             from 'chalk';
import {existsSync, readFile, writeFile} from 'fs';
import {dirname, resolve}                from 'path';
import supportsColor                     from 'supports-color';
import {promisify}                       from 'util';

import {MultiFetcher}                    from './MultiFetcher';
import {MultiResolver}                   from './MultiResolver';
import {Plugin, BerryHooks}              from './Plugin';
import {SemverResolver}                  from './SemverResolver';
import {TagResolver}                     from './TagResolver';
import {VirtualFetcher}                  from './VirtualFetcher';
import {WorkspaceFetcher}                from './WorkspaceFetcher';
import {WorkspaceResolver}               from './WorkspaceResolver';
import * as structUtils                  from './structUtils';

// @ts-ignore
const ctx: any = new chalk.constructor({enabled: true});

const readFileP = promisify(readFile);
const writeFileP = promisify(writeFile);

export enum SettingsType {
  BOOLEAN = 'BOOLEAN',
  ABSOLUTE_PATH = 'ABSOLUTE_PATH',
  LOCATOR = 'LOCATOR',
  LOCATOR_LOOSE = 'LOCATOR_LOOSE',
  STRING = 'STRING',
};

export type SettingsDefinition = {
  description: string,
  type: SettingsType,
  default: any,
  isArray?: boolean,
  isNullable?: boolean,
};

export const coreDefinitions = {
  // Settings related to the proxying Berry to a specific executable
  executablePath: {
    description: `Path to the local executable that must be used over the global one`,
    type: SettingsType.ABSOLUTE_PATH,
    default: null,
  },
  ignorePath: {
    description: `If true, the local executable will be ignored when using the global one`,
    type: SettingsType.BOOLEAN,
    default: false,
  },

  // Settings related to the package manager internal names
  lockfilePath: {
    description: `Path of the file where the dependency tree must be stored`,
    type: SettingsType.ABSOLUTE_PATH,
    default: `./berry.lock`,
  },
  cacheFolder: {
    description: `Folder where the cache files must be written`,
    type: SettingsType.ABSOLUTE_PATH,
    default: `./.berry/cache`,
  },
  virtualFolder: {
    description: `Folder where the symlinks generated for virtual packages must be written`,
    type: SettingsType.ABSOLUTE_PATH,
    default: `./.berry/virtual`,
  },
  bstatePath: {
    description: `Path of the file where the current state of the built packages must be stored`,
    type: SettingsType.ABSOLUTE_PATH,
    default: `./.berry/buildState.yml`,
  },

  // Settings related to the output style
  enableEmojis: {
    description: `If true, the CLI is allowed to use emojis in its output`,
    type: SettingsType.BOOLEAN,
    default: !!supportsColor.stdout,
    defaultText: `<dynamic>`,
  },
  enableColors: {
    description: `If true, the CLI is allowed to use colors in its output`,
    type: SettingsType.BOOLEAN,
    default: !!supportsColor.stdout,
    defaultText: `<dynamic>`,
  },

  // Settings related to how packages are interpreted by default
  defaultLanguageName: {
    description: `Default language mode that should be used when a package doesn't offer any insight`,
    type: SettingsType.STRING,
    default: `node`,
  },
  defaultProtocol: {
    description: `Default resolution protocol used when resolving pure semver and tag ranges`,
    type: SettingsType.STRING,
    default: `npm:`,
  },

  // Settings related to network proxies
  httpProxy: {
    description: `URL of the http proxy that must be used for outgoing http requests`,
    type: SettingsType.STRING,
    default: null,
  },
  httpsProxy: {
    description: `URL of the http proxy that must be used for outgoing https requests`,
    type: SettingsType.STRING,
    default: null,
  },

  // Settings related to security
  enableScripts: {
    description: `If true, packages are allowed to have install scripts by default`,
    type: SettingsType.BOOLEAN,
    default: true,
  },
};

function parseBoolean(value: unknown) {
  switch (value) {
    case `true`:
    case `1`:
    case 1:
    case true: {
      return true;
    } break;

    case `false`:
    case `0`:
    case 0:
    case false: {
      return false;
    } break;

    default: {
      throw new Error(`Couldn't parse "${value}" as a boolean`);
    } break;
  }
}

function parseValue(value: unknown, type: SettingsType, folder: string) {
  if (type === SettingsType.BOOLEAN)
    return parseBoolean(value);

  if (typeof value !== `string`)
    throw new Error(`Expected value to be a string`);
  
  if (type === SettingsType.ABSOLUTE_PATH) {
    return resolve(folder, value);
  } else if (type === SettingsType.LOCATOR_LOOSE) {
    return structUtils.parseLocator(value, false);
  } else if (type === SettingsType.LOCATOR) {
    return structUtils.parseLocator(value);
  } else {
    return value;
  }
}

export class Configuration {
  // General rules:
  //
  // - filenames that don't accept actual paths must end with the "Name" suffix
  //   prefer to use absolute paths instead, since they are automatically resolved
  //   ex: lockfileName (doesn't actually exist)
  //
  // - folders must end with the "Folder" suffix
  //   ex: cacheFolder, pnpVirtualFolder
  //
  // - actual paths to a file must end with the "Path" suffix
  //   ex: lockfilePath, pnpPath
  //
  // - options that tweaks the strictness must begin with the "allow" prefix
  //   ex: allowInvalidChecksums
  //
  // - options that enable a feature must begin with the "enable" prefix
  //   ex: enableEmojis, enableColors

  public projectCwd: string | null;

  public plugins: Map<string, Plugin> = new Map();
  
  public settings: Map<string, SettingsDefinition> = new Map();
  public sources: Map<string, string> = new Map();

  [name: string]: any;

  static async find(startingCwd: string, plugins: Map<string, Plugin>) {
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

  constructor(projectCwd: string | null, plugins: Map<string, Plugin>) {
    this.projectCwd = projectCwd;
    this.plugins = plugins;

    const importSettings = (definitions: {[name: string]: SettingsDefinition}) => {
      for (const [name, definition] of Object.entries(definitions)) {
        if (this.settings.has(name))
          throw new Error(`Cannot redefine settings "${name}"`);
        else if (name in this)
          throw new Error(`Settings named "${name}" conflicts with an actual property`);

        this.settings.set(name, definition);

        if (definition.type === SettingsType.ABSOLUTE_PATH && definition.default !== null) {
          if (this.projectCwd === null) {
            if (definition.isNullable || definition.default === null) {
              this[name] = null;
            } else {
              Object.defineProperty(this, name, {
                configurable: true,
                get: () => {
                  throw new Error(`Unusable configuration settings "${name}" - not in a project folder`);
                },
                set: (newValue: any) => {
                  Object.defineProperty(this, name, {
                    value: newValue,
                  });
                },
              });
            }
          } else {
            const projectCwd = this.projectCwd;
            if (Array.isArray(definition.default)) {
              this[name] = definition.default.map((entry: string) => resolve(projectCwd, entry));
            } else {
              this[name] = resolve(projectCwd, definition.default);
            }
          }
        } else {
          this[name] = definition.default;
        }
      }
    };

    importSettings(coreDefinitions);

    for (const plugin of this.plugins.values()) {
      if (plugin.configuration) {
        importSettings(plugin.configuration);
      }
    }
  }

  async inherits(source: string) {
    const content = await readFileP(source, `utf8`);
    const data = parseSyml(content);

    this.use(source, data, dirname(source));
  }

  use(source: string, data: {[key: string]: unknown}, folder: string) {
    for (const key of Object.keys(data)) {
      const name = key.replace(/[_-]([a-z])/g, ($0, $1) => $1.toUpperCase());
      if (name === `binFolder`)
        continue;

      const definition = this.settings.get(name);
      if (!definition)
        throw new Error(`Unknown configuration settings "${name}" - have you forgot a plugin?`);
      
      if (this.sources.has(name))
        continue;
      
      let value = data[key];
      if (value === null && !definition.isNullable && definition.default !== null)
        throw new Error(`Non-nullable configuration settings "${name}" cannot be set to null`);
      
      if (Array.isArray(value)) {
        if (!definition.isArray && !Array.isArray(definition.default)) {
          throw new Error(`Non-array configuration settings "${name}" cannot be an array`);
        } else {
          value = value.map(sub => parseValue(sub, definition.type, folder));
        }
      } else {
        value = parseValue(value, definition.type, folder);
      }

      // @ts-ignore
      this[name] = value;
      this.sources.set(name, source);
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
    const pluginFetchers = [];

    for (const plugin of this.plugins.values())
      for (const fetcher of plugin.fetchers || [])
        pluginFetchers.push(new fetcher());

    return new MultiFetcher([
      new VirtualFetcher(),
      new WorkspaceFetcher(),

      ... pluginFetchers,
    ]);
  }

  getLinkers() {
    const linkers = [];

    for (const plugin of this.plugins.values())
      for (const linker of plugin.linkers || [])
        linkers.push(new linker());

    return linkers;
  }

  async triggerHook<U extends any[], V>(get: (hooks: BerryHooks) => ((... args: U) => V) | undefined, ... args: U): Promise<void> {
    for (const plugin of this.plugins.values()) {
      const hooks = plugin.hooks;
      if (!hooks)
        continue;

      const hook = get(hooks);
      if (!hook)
        continue;

      await hook(... args);
    }
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
