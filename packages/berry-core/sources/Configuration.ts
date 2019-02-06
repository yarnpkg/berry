import {xfs}                             from '@berry/fslib';
import {parseSyml, stringifySyml}        from '@berry/parsers';
// @ts-ignore
import {UsageError}                      from '@manaflair/concierge';
import chalk                             from 'chalk';
import {homedir}                         from 'os';
import {posix}                           from 'path';
import supportsColor                     from 'supports-color';

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

const legacyNames = new Set([
  `network-concurrency`,
  `child-concurrency`,
  `network-timeout`,
  `proxy`,
  `strict-ssl`,
  `ca`,
  `cert`,
  `key`,
  `plugnplay-override`,
  `plugnplay-shebang`,
  `plugnplay-blacklist`,
  `workspaces-experimental`,
  `workspaces-nohoist-experimental`,
  `offline-cache-folder`,
  `yarn-offline-mirror-pruning`,
  `enable-meta-folder`,
  `yarn-enable-lockfile-versions`,
  `yarn-link-file-dependencies`,
  `experimental-pack-script-packages-in-mirror`,
  `unsafe-disable-integrity-migration`,
  `production`,
  `no-progress`,
  `registry`,
  `version-commit-hooks`,
  `version-git-tag`,
  `version-git-message`,
  `version-sign-git-tag`,
  `version-tag-prefix`,
  `save-prefix`,
  `save-exact`,
  `init-author-name`,
  `init-author-email`,
  `init-author-url`,
  `init-version`,
  `init-license`,
  `init-private`,
  `ignore-scripts`,
  `ignore-platform`,
  `ignore-engines`,
  `ignore-optional`,
  `force`,
  `disable-self-update-check`,
  `username`,
]);

export const RCFILE_NAME = `.yarnrc`;
export const ENVIRONMENT_PREFIX = `yarn_`;

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
  yarnPath: {
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
  globalFolder: {
    description: `Folder where are stored the system-wide settings`,
    type: SettingsType.ABSOLUTE_PATH,
    default: getDefaultGlobalFolder(),
  },
  lockfilePath: {
    description: `Path of the file where the dependency tree must be stored`,
    type: SettingsType.ABSOLUTE_PATH,
    default: `./yarn.lock`,
  },
  cacheFolder: {
    description: `Folder where the cache files must be written`,
    type: SettingsType.ABSOLUTE_PATH,
    default: `./.yarn/cache`,
  },
  virtualFolder: {
    description: `Folder where the symlinks generated for virtual packages must be written`,
    type: SettingsType.ABSOLUTE_PATH,
    default: `./.yarn/virtual`,
  },
  bstatePath: {
    description: `Path of the file where the current state of the built packages must be stored`,
    type: SettingsType.ABSOLUTE_PATH,
    default: `./.yarn/build-state.yml`,
  },

  // Settings related to the output style
  enableColors: {
    description: `If true, the CLI is allowed to use colors in its output`,
    type: SettingsType.BOOLEAN,
    default: !!supportsColor.stdout,
    defaultText: `<dynamic>`,
  },
  enableTimers: {
    description: `If true, the CLI is allowed to print the time spent executing commands`,
    type: SettingsType.BOOLEAN,
    default: true,
  },
  preferInteractive: {
    description: `If true, the CLI will automatically use the interactive mode when called from a TTY`,
    type: SettingsType.BOOLEAN,
    default: false,
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
    return posix.resolve(folder, value);
  } else if (type === SettingsType.LOCATOR_LOOSE) {
    return structUtils.parseLocator(value, false);
  } else if (type === SettingsType.LOCATOR) {
    return structUtils.parseLocator(value);
  } else {
    return value;
  }
}

function getDefaultGlobalFolder() {
  if (process.platform === `win32`) {
    return posix.resolve(process.env.LOCALAPPDATA || posix.join(homedir(), 'AppData', 'Local'));
  } else if (process.env.XDG_DATA_HOME) {
    return posix.resolve(process.env.XDG_DATA_HOME, 'yarn/modern');
  } else {
    return posix.resolve(homedir(), `.local/share/yarn/modern`);
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

  public values: Map<string, any> = new Map();
  public sources: Map<string, string> = new Map();

  static async find(startingCwd: string, plugins: Map<string, Plugin>) {
    let projectCwd = null;
    const rcCwds = [];

    let nextCwd = startingCwd;
    let currentCwd = null;

    while (nextCwd !== currentCwd) {
      currentCwd = nextCwd;

      if (xfs.existsSync(`${currentCwd}/package.json`))
        projectCwd = currentCwd;

      if (xfs.existsSync(`${currentCwd}/${RCFILE_NAME}`))
        rcCwds.push(currentCwd);

      nextCwd = posix.dirname(currentCwd);
    }

    const configuration = new Configuration(projectCwd, plugins);

    const environmentData: {[key: string]: any} = {};

    for (let [key, value] of Object.entries(process.env)) {
      key = key.toLowerCase();

      if (!key.startsWith(ENVIRONMENT_PREFIX))
        continue;

      key = key.slice(ENVIRONMENT_PREFIX.length);

      environmentData[key] = value;
    }

    configuration.use(`<environment>`, environmentData, process.cwd());

    for (const rcCwd of rcCwds)
      await configuration.inherits(`${rcCwd}/${RCFILE_NAME}`);

    return configuration;
  }

  static async updateConfiguration(cwd: string, patch: any) {
    const configurationPath = `${cwd}/${RCFILE_NAME}`;

    const current = xfs.existsSync(configurationPath)
      ? parseSyml(await xfs.readFilePromise(configurationPath, `utf8`)) as any
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

    await xfs.writeFilePromise(configurationPath, stringifySyml(current));
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
              this.values.set(name, null);
            }
          } else {
            const projectCwd = this.projectCwd;
            if (Array.isArray(definition.default)) {
              this.values.set(name, definition.default.map((entry: string) => posix.resolve(projectCwd, entry)));
            } else {
              this.values.set(name, posix.resolve(projectCwd, definition.default));
            }
          }
        } else {
          this.values.set(name, definition.default);
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
    const content = await xfs.readFilePromise(source, `utf8`);
    const data = parseSyml(content);

    this.use(source, data, posix.dirname(source));
  }

  use(source: string, data: {[key: string]: unknown}, folder: string) {
    for (const key of Object.keys(data)) {
      const name = key.replace(/[_-]([a-z])/g, ($0, $1) => $1.toUpperCase());

      // binFolder is the magic location where the parent process stored the current binaries; not an actual configuration settings
      if (name === `binFolder`)
        continue;

      const definition = this.settings.get(name);
      if (!definition)
        throw new UsageError(`${legacyNames.has(key) ? `Legacy` : `Unrecognized`} configuration settings found: ${key} (via ${source}) - run "yarn config -v" to see the list of settings supported in Yarn`);
      
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
      this.values.set(name, value);
      this.sources.set(name, source);
    }
  }

  get(key: string) {
    if (!this.values.has(key))
      throw new Error(`Invalid configuration key "${key}"`);

    return this.values.get(key);
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
    if (this.get(`enableColors`)) {
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
