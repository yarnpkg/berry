import {xfs, NodeFS, PortablePath, ppath, Filename, toFilename} from '@berry/fslib';
import {parseSyml, stringifySyml}                               from '@berry/parsers';
import camelcase                                                from 'camelcase';
import chalk                                                    from 'chalk';
import {UsageError}                                             from 'clipanion';
import supportsColor                                            from 'supports-color';

import {MultiFetcher}                                           from './MultiFetcher';
import {MultiResolver}                                          from './MultiResolver';
import {Plugin, Hooks}                                          from './Plugin';
import {SemverResolver}                                         from './SemverResolver';
import {TagResolver}                                            from './TagResolver';
import {VirtualFetcher}                                         from './VirtualFetcher';
import {WorkspaceFetcher}                                       from './WorkspaceFetcher';
import {WorkspaceResolver}                                      from './WorkspaceResolver';
import * as folderUtils                                         from './folderUtils';
import * as miscUtils                                           from './miscUtils';
import * as nodeUtils                                           from './nodeUtils';
import * as structUtils                                         from './structUtils';

// @ts-ignore
const ctx: any = new chalk.constructor({enabled: true});

const IGNORED_ENV_VARIABLES = new Set([
  // "binFolder" is the magic location where the parent process stored the current binaries; not an actual configuration settings
  `binFolder`,
  // "version" is set by Docker: https://github.com/nodejs/docker-node/blob/5a6a5e91999358c5b04fddd6c22a9a4eb0bf3fbf/10/alpine/Dockerfile#L51
  `version`,
  // "flags" is set by Netlify; they use it to specify the flags to send to the CLI when running the automatic `yarn install`
  `flags`,
]);

const LEGACY_NAMES = new Set([
  `networkConcurrency`,
  `childConcurrency`,
  `networkTimeout`,
  `proxy`,
  `strictSsl`,
  `ca`,
  `cert`,
  `key`,
  `lastUpdateCheck`,
  `plugnplayOverride`,
  `plugnplayShebang`,
  `plugnplayBlacklist`,
  `workspacesExperimental`,
  `workspacesNohoistExperimental`,
  `offlineCacheFolder`,
  `yarnOfflineMirrorPruning`,
  `enableMetaFolder`,
  `yarnEnableLockfileVersions`,
  `yarnLinkFileDependencies`,
  `experimentalPackScriptPackagesInMirror`,
  `unsafeDisableIntegrityMigration`,
  `production`,
  `noProgress`,
  `registry`,
  `versionCommitHooks`,
  `versionGitTag`,
  `versionGitMessage`,
  `versionSignGitTag`,
  `versionTagPrefix`,
  `savePrefix`,
  `saveExact`,
  `initAuthorName`,
  `initAuthorEmail`,
  `initAuthorUrl`,
  `initVersion`,
  `initLicense`,
  `initPrivate`,
  `ignoreScripts`,
  `ignorePlatform`,
  `ignoreEngines`,
  `ignoreOptional`,
  `force`,
  `disableSelfUpdateCheck`,
  `username`,
  `email`,
]);

export const ENVIRONMENT_PREFIX = `yarn_`;
export const DEFAULT_RC_FILENAME = toFilename(`.yarnrc.yml`);
export const DEFAULT_LOCK_FILENAME = toFilename(`yarn.lock`);

export enum SettingsType {
  BOOLEAN = 'BOOLEAN',
  ABSOLUTE_PATH = 'ABSOLUTE_PATH',
  LOCATOR = 'LOCATOR',
  LOCATOR_LOOSE = 'LOCATOR_LOOSE',
  STRING = 'STRING',
  SECRET = 'SECRET',
  SHAPE = 'SHAPE',
  MAP = 'MAP',
};

export type BaseSettingsDefinition<T extends SettingsType = SettingsType> = {
  description: string,
  type: T,
  isArray?: boolean,
};

export type ShapeSettingsDefinition = BaseSettingsDefinition<SettingsType.SHAPE> & {
  properties: {[propertyName: string]: SettingsDefinition},
};

export type MapSettingsDefinition = BaseSettingsDefinition<SettingsType.MAP> & {
  valueDefinition: SettingsDefinition,
};

export type SimpleSettingsDefinition = BaseSettingsDefinition<Exclude<SettingsType, SettingsType.SHAPE | SettingsType.MAP>> & {
  default: any,
  defaultText?: any,
  isNullable?: boolean,
};

export type SettingsDefinition = MapSettingsDefinition|ShapeSettingsDefinition|SimpleSettingsDefinition;

export type PluginConfiguration = {
  modules: Map<string, any>,
  plugins: Set<string>,
};

// General rules:
//
// - filenames that don't accept actual paths must end with the "Filename" suffix
//   prefer to use absolute paths instead, since they are automatically resolved
//   ex: lockfileFilename
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
export const coreDefinitions: {[coreSettingName: string]: SettingsDefinition} = {
  // Not implemented for now, but since it's part of all Yarn installs we want to declare it in order to improve drop-in compatibility
  lastUpdateCheck: {
    description: `Last timestamp we checked whether new Yarn versions were available`,
    type: SettingsType.STRING,
    default: null,
  },

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
    default: folderUtils.getDefaultGlobalFolder(),
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
  lockfileFilename: {
    description: `Name of the files where the Yarn dependency tree entries must be stored`,
    type: SettingsType.STRING,
    default: DEFAULT_LOCK_FILENAME,
  },
  rcFilename: {
    description: `Name of the files where the configuration can be found`,
    type: SettingsType.STRING,
    default: getRcFilename(),
  },
  enableGlobalCache: {
    description: `If true, the system-wide cache folder will be used regardless of \`cache-folder\``,
    type: SettingsType.BOOLEAN,
    default: false,
  },
  enableAbsoluteVirtuals: {
    description: `If true, the virtual symlinks will use absolute paths if required [non portable!!]`,
    type: SettingsType.BOOLEAN,
    default: false,
  },

  // Settings related to the output style
  enableColors: {
    description: `If true, the CLI is allowed to use colors in its output`,
    type: SettingsType.BOOLEAN,
    default: !!supportsColor.stdout,
    defaultText: `<dynamic>`,
  },
  enableInlineBuilds: {
    description: `If true, the CLI will print the build output on the command line`,
    type: SettingsType.BOOLEAN,
    default: !!process.env.CI,
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

  // Settings related to network access
  enableNetwork: {
    description: `If false, the package manager will refuse to use the network if required to`,
    type: SettingsType.BOOLEAN,
    default: true,
  },
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
  checksumBehavior: {
    description: `Enumeration defining what to do when a checksum doesn't match expectations`,
    type: SettingsType.STRING,
    default: `throw`,
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

function parseValue(configuration: Configuration, path: string, value: unknown, definition: SettingsDefinition, folder: PortablePath) {
  if (definition.isArray) {
    if (!Array.isArray(value)) {
      return [parseSingleValue(configuration, path, value, definition, folder)];
    } else {
      return value.map((sub, i) => parseSingleValue(configuration, `${path}[${i}]`, sub, definition, folder));
    }
  } else {
    if (Array.isArray(value)) {
      throw new Error(`Non-array configuration settings "${path}" cannot be an array`);
    } else {
      return parseSingleValue(configuration, path, value, definition, folder);
    }
  }
}

function parseSingleValue(configuration: Configuration, path: string, value: unknown, definition: SettingsDefinition, folder: PortablePath) {
  switch (definition.type) {
    case SettingsType.SHAPE:
      return parseShape(configuration, path, value, definition, folder);
    case SettingsType.MAP:
      return parseMap(configuration, path, value, definition, folder);
  }

  if (value === null && !definition.isNullable && definition.default !== null)
    throw new Error(`Non-nullable configuration settings "${path}" cannot be set to null`);

  if (definition.type === SettingsType.BOOLEAN)
    return parseBoolean(value);

  if (typeof value !== `string`)
    throw new Error(`Expected value to be a string`);

  switch (definition.type) {
    case SettingsType.ABSOLUTE_PATH:
      return ppath.resolve(folder, NodeFS.toPortablePath(value));
    case SettingsType.LOCATOR_LOOSE:
      return structUtils.parseLocator(value, false);
    case SettingsType.LOCATOR:
      return structUtils.parseLocator(value);
    default:
      return value;
  }
}

function parseShape(configuration: Configuration, path: string, value: unknown, definition: ShapeSettingsDefinition, folder: PortablePath) {
  if (typeof value !== `object` || Array.isArray(value))
    throw new UsageError(`Object configuration settings "${path}" must be an object`);

  const result: Map<string, any> = getDefaultValue(configuration, definition);

  if (value === null)
    return result;

  for (const [propKey, propValue] of Object.entries(value)) {
    const subPath = `${path}.${propKey}`;
    const subDefinition = definition.properties[propKey];

    if (!subDefinition)
      throw new UsageError(`Unrecognized configuration settings found: ${path}.${propKey} - run "yarn config -v" to see the list of settings supported in Yarn`);

    result.set(propKey, parseValue(configuration, subPath, propValue, definition.properties[propKey], folder));
  }

  return result;
}

function parseMap(configuration: Configuration, path: string, value: unknown, definition: MapSettingsDefinition, folder: PortablePath) {
  const result = new Map<string, any>();

  if (typeof value !== 'object' || Array.isArray(value))
    throw new UsageError(`Map configuration settings "${path}" must be an object`);

  if (value === null)
    return result;

  for (const [propKey, propValue] of Object.entries(value)) {
    const subPath = `${path}['${propKey}']`;

    result.set(propKey, parseValue(configuration, subPath, propValue, definition.valueDefinition, folder));
  }

  return result;
}

function getDefaultValue(configuration: Configuration, definition: SettingsDefinition) {
  switch (definition.type) {
    case SettingsType.SHAPE: {
      const result = new Map<string, any>();

      for (const [propKey, propDefinition] of Object.entries(definition.properties))
        result.set(propKey, getDefaultValue(configuration, propDefinition));

      return result;
    }
    case SettingsType.MAP:
      return new Map<string, any>();
    case SettingsType.ABSOLUTE_PATH: {
      if (definition.default === null)
        return null;

      if (configuration.projectCwd === null) {
        if (ppath.isAbsolute(definition.default)) {
          return ppath.normalize(definition.default);
        } else if (definition.isNullable || definition.default === null) {
          return null;
        }
      } else {
        if (Array.isArray(definition.default)) {
          return definition.default.map((entry: string) => ppath.resolve(configuration.projectCwd!, entry as PortablePath));
        } else {
          return ppath.resolve(configuration.projectCwd, definition.default);
        }
      }
    }
    default:
      return definition.default;
  }
}

function getEnvironmentSettings() {
  const environmentSettings: {[key: string]: any} = {};

  for (let [key, value] of Object.entries(process.env)) {
    key = key.toLowerCase();

    if (!key.startsWith(ENVIRONMENT_PREFIX))
      continue;

    key = camelcase(key.slice(ENVIRONMENT_PREFIX.length));

    environmentSettings[key] = value;
  }

  return environmentSettings;
}

function getRcFilename() {
  const rcKey = `${ENVIRONMENT_PREFIX}rc_filename`;

  for (const [key, value] of Object.entries(process.env))
    if (key.toLowerCase() === rcKey)
      return value;

  return DEFAULT_RC_FILENAME;
}

export class Configuration {
  public startingCwd: PortablePath;
  public projectCwd: PortablePath | null;

  public plugins: Map<string, Plugin> = new Map();

  public settings: Map<string, SettingsDefinition> = new Map();
  public values: Map<string, any> = new Map();
  public sources: Map<string, string> = new Map();

  public invalid: Map<string, string> = new Map();

  /**
   * Instantiate a new configuration object exposing the configuration obtained
   * from reading the various rc files and the environment settings.
   *
   * The `pluginConfiguration` parameter is expected to indicate:
   *
   * 1. which modules should be made available to plugins when they require a
   *    package (this is the dynamic linking part - for example we want all the
   *    plugins to use the exact same version of @berry/core, which also is the
   *    version used by the running Yarn instance).
   *
   * 2. which of those modules are actually plugins that need to be injected
   *    within the configuration.
   *
   * Note that some extra plugins will be automatically added based on the
   * content of the rc files - with the rc plugins taking precedence over
   * the other ones.
   *
   * One particularity: the plugin initialization order is quite strict, with
   * plugins listed in /foo/bar/.yarnrc.yml taking precedence over plugins
   * listed in /foo/.yarnrc.yml and /.yarnrc.yml. Additionally, while plugins
   * can depend on one another, they can only depend on plugins that have been
   * instantiated before them (so a plugin listed in /foo/.yarnrc.yml can
   * depend on another one listed on /foo/bar/.yarnrc.yml, but not the other
   * way around).
   */

  static async find(startingCwd: PortablePath, pluginConfiguration: PluginConfiguration | null, {strict = true, useRc = true}: {strict?: boolean, useRc?: boolean} = {}) {
    const environmentSettings = getEnvironmentSettings();
    delete environmentSettings.rcFilename;

    const rcFiles = await Configuration.findRcFiles(startingCwd);
    const plugins = new Map();

    if (pluginConfiguration !== null) {
      for (const request of pluginConfiguration.plugins.keys())
        plugins.set(request, pluginConfiguration.modules.get(request).default);

      const requireEntries = new Map();
      for (const request of nodeUtils.builtinModules())
        requireEntries.set(request, () => nodeUtils.dynamicRequire(request));
      for (const [request, embedModule] of pluginConfiguration.modules)
        requireEntries.set(request, () => embedModule);

      const dynamicPlugins = new Set();

      for (const {path, cwd, data} of rcFiles) {
        if (!useRc)
          continue;
        if (!Array.isArray(data.plugins))
          continue;

        for (const userProvidedPath of data.plugins) {
          const pluginPath = ppath.resolve(cwd, NodeFS.toPortablePath(userProvidedPath));
          const {factory, name} = nodeUtils.dynamicRequire(NodeFS.fromPortablePath(pluginPath));

          // Prevent plugin redefinition so that the ones declared deeper in the
          // filesystem always have precedence over the ones below.
          if (dynamicPlugins.has(name))
            continue;

          const pluginRequireEntries = new Map(requireEntries);
          const pluginRequire = (request: string) => {
            if (pluginRequireEntries.has(request)) {
              return pluginRequireEntries.get(request)();
            } else {
              throw new UsageError(`This plugin cannot access the package referenced via ${request} which is neither a builtin, nor an exposed entry`);
            }
          };

          const plugin = miscUtils.prettifySyncErrors(() => {
            return factory(pluginRequire).default;
          }, message => {
            return `${message} (when initializing ${name}, defined in ${path})`;
          });

          requireEntries.set(name, () => plugin);

          dynamicPlugins.add(name);
          plugins.set(name, plugin);
        }
      }
    }

    let lockfileFilename = DEFAULT_LOCK_FILENAME;

    // We need to know the project root before being able to truly instantiate
    // our configuration, and to know that we need to know the lockfile name
    if (environmentSettings.lockfileFilename) {
      lockfileFilename = environmentSettings.lockfileFilename;
    } else {
      for (const {data} of rcFiles) {
        if (data.lockfileFilename) {
          lockfileFilename = data.lockfileFilename;
          break;
        }
      }
    }

    const projectCwd = await Configuration.findProjectCwd(startingCwd, lockfileFilename);

    const configuration = new Configuration(startingCwd, projectCwd, plugins);
    configuration.useWithSource(`<environment>`, environmentSettings, startingCwd, {strict});

    for (const {path, cwd, data} of rcFiles)
      configuration.useWithSource(path, data, cwd, {strict});

    const rcFilename = configuration.get(`rcFilename`);
    const homeRcFile = await Configuration.findHomeRcFile(rcFilename);

    if (homeRcFile)
      configuration.useWithSource(homeRcFile.path, homeRcFile.data, homeRcFile.cwd, {strict});

    if (configuration.get(`enableGlobalCache`)) {
      configuration.values.set(`cacheFolder`, `${configuration.get(`globalFolder`)}/cache`);
      configuration.sources.set(`cacheFolder`, `<internal>`);
    }

    return configuration;
  }

  static async findRcFiles(startingCwd: PortablePath) {
    const rcFilename = getRcFilename();
    const rcFiles = [];

    let nextCwd = startingCwd;
    let currentCwd = null;

    while (nextCwd !== currentCwd) {
      currentCwd = nextCwd;

      const rcPath = ppath.join(currentCwd, rcFilename as PortablePath);

      if (xfs.existsSync(rcPath)) {
        const content = await xfs.readFilePromise(rcPath, `utf8`);

        let data;
        try {
          data = parseSyml(content) as any;
        } catch (error) {
          let tip = ``;

          if (content.match(/^\s+(?!-)[^:]+\s+\S+/m))
            tip = ` (in particular, make sure you list the colons after each key name)`

          throw new UsageError(`Parse error when loading ${rcPath}; please check it's proper Yaml${tip}`);
        }

        rcFiles.push({path: rcPath, cwd: currentCwd, data});
      }

      nextCwd = ppath.dirname(currentCwd);
    }

    return rcFiles;
  }

  static async findHomeRcFile(rcFilename: string) {
    const homeFolder = folderUtils.getHomeFolder();
    const homeRcFilePath = ppath.join(homeFolder, rcFilename as PortablePath);

    if (xfs.existsSync(homeRcFilePath)) {
      const content = await xfs.readFilePromise(homeRcFilePath, `utf8`);
      const data = parseSyml(content) as any;

      return {path: homeRcFilePath, cwd: homeFolder, data};
    }

    return null;
  }

  static async findProjectCwd(startingCwd: PortablePath, lockfileFilename: Filename) {
    let projectCwd = null;

    let nextCwd = startingCwd;
    let currentCwd = null;

    while (nextCwd !== currentCwd) {
      currentCwd = nextCwd;

      if (xfs.existsSync(ppath.join(currentCwd, toFilename(`package.json`))))
        projectCwd = currentCwd;

      if (xfs.existsSync(ppath.join(currentCwd, lockfileFilename)))
        break;

      nextCwd = ppath.dirname(currentCwd);
    }

    return projectCwd;
  }

  static async updateConfiguration(cwd: PortablePath, patch: any) {
    const rcFilename = getRcFilename();
    const configurationPath =  ppath.join(cwd, rcFilename as PortablePath);

    const current = xfs.existsSync(configurationPath)
      ? parseSyml(await xfs.readFilePromise(configurationPath, `utf8`)) as any
      : {};

    let patched = false;

    if (typeof patch === `function`)
      patch = patch(current);

    for (const key of Object.keys(patch)) {
      const currentValue = current[key];

      const nextValue = typeof patch[key] === `function`
        ? patch[key](currentValue)
        : patch[key];

      if (currentValue === nextValue)
        continue;

      current[key] = nextValue;
      patched = true;
    }

    if (!patched)
      return;

    await xfs.changeFilePromise(configurationPath, stringifySyml(current));
  }

  static async updateHomeConfiguration(patch: any) {
    const homeFolder = folderUtils.getHomeFolder();

    return await Configuration.updateConfiguration(homeFolder, patch);
  }

  constructor(startingCwd: PortablePath, projectCwd: PortablePath | null, plugins: Map<string, Plugin>) {
    this.startingCwd = startingCwd;
    this.projectCwd = projectCwd;

    this.plugins = plugins;

    const importSettings = (definitions: {[name: string]: SettingsDefinition}) => {
      for (const [name, definition] of Object.entries(definitions)) {
        if (this.settings.has(name))
          throw new Error(`Cannot redefine settings "${name}"`);
        else if (name in this)
          throw new Error(`Settings named "${name}" conflicts with an actual property`);

        this.settings.set(name, definition);
        this.values.set(name, getDefaultValue(this, definition));
      }
    };

    importSettings(coreDefinitions);

    for (const plugin of this.plugins.values()) {
      if (plugin.configuration) {
        importSettings(plugin.configuration);
      }
    }
  }

  extend(data: {[key: string]: unknown}) {
    const newConfiguration = Object.create(Configuration.prototype);

    newConfiguration.startingCwd = this.startingCwd;
    newConfiguration.projectCwd = this.projectCwd;

    newConfiguration.plugins = new Map(this.plugins);

    newConfiguration.settings = new Map(this.settings);
    newConfiguration.values = new Map(this.values);
    newConfiguration.sources = new Map(this.sources);

    newConfiguration.invalid = new Map(this.invalid);

    newConfiguration.useWithSource(`<internal override>`, data, this.startingCwd, {override: true});

    return newConfiguration;
  }

  useWithSource(source: string, data: {[key: string]: unknown}, folder: PortablePath, {strict = true, overwrite = false}: {strict?: boolean, overwrite?: boolean}) {
    try {
      this.use(source, data, folder, {strict, overwrite});
    } catch (error) {
      error.message += ` (in ${source})`;
      throw error;
    }
  }

  use(source: string, data: {[key: string]: unknown}, folder: PortablePath, {strict = true, overwrite = false}: {strict?: boolean, overwrite?: boolean}) {
    if (typeof data.berry === `object` && data.berry !== null)
      data = data.berry;

    for (const key of Object.keys(data)) {
      // The plugins have already been loaded at this point
      if (key === `plugins`)
        continue;

      // Some environment variables should be ignored when applying the configuration
      if (source === `<environment>` && IGNORED_ENV_VARIABLES.has(key))
        continue;

      // It wouldn't make much sense, would it?
      if (key === `rcFilename`)
        throw new UsageError(`The rcFilename settings can only be set via ${`${ENVIRONMENT_PREFIX}RC_FILENAME`.toUpperCase()}, not via a rc file`);

      const definition = this.settings.get(key);
      if (!definition) {
        if (strict) {
          throw new UsageError(`${LEGACY_NAMES.has(key) ? `Legacy` : `Unrecognized`} configuration settings found: ${key} - run "yarn config -v" to see the list of settings supported in Yarn`);
        } else {
          this.invalid.set(key, source);
          continue;
        }
      }

      if (this.sources.has(key) && !overwrite)
        continue;

      this.values.set(key, parseValue(this, key, data[key], definition, folder));
      this.sources.set(key, source);
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

      ...pluginResolvers,
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

      ...pluginFetchers,
    ]);
  }

  getLinkers() {
    const linkers = [];

    for (const plugin of this.plugins.values())
      for (const linker of plugin.linkers || [])
        linkers.push(new linker());

    return linkers;
  }

  async triggerHook<U extends any[], V, HooksDefinition = Hooks>(get: (hooks: HooksDefinition) => ((...args: U) => V) | undefined, ...args: U): Promise<void> {
    for (const plugin of this.plugins.values()) {
      const hooks = plugin.hooks as HooksDefinition;
      if (!hooks)
        continue;

      const hook = get(hooks);
      if (!hook)
        continue;

      await hook(...args);
    }
  }

  async triggerMultipleHooks<U extends any[], V, HooksDefinition = Hooks>(get: (hooks: HooksDefinition) => ((...args: U) => V) | undefined, argsList: Array<U>): Promise<void> {
    for (const args of argsList) {
      await this.triggerHook(get, ...args);
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
