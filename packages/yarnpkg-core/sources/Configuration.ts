import {Filename, PortablePath, npath, ppath, toFilename, xfs} from '@yarnpkg/fslib';
import {parseSyml, stringifySyml}                              from '@yarnpkg/parsers';
import camelcase                                               from 'camelcase';
import chalk                                                   from 'chalk';
import {UsageError}                                            from 'clipanion';
import isCI                                                    from 'is-ci';
import semver                                                  from 'semver';
import {PassThrough, Writable}                                 from 'stream';
import supportsColor                                           from 'supports-color';
import {tmpNameSync}                                           from 'tmp';

import {Manifest}                                              from './Manifest';
import {MultiFetcher}                                          from './MultiFetcher';
import {MultiResolver}                                         from './MultiResolver';
import {Plugin, Hooks}                                         from './Plugin';
import {ProtocolResolver}                                      from './ProtocolResolver';
import {Report}                                                from './Report';
import {VirtualFetcher}                                        from './VirtualFetcher';
import {VirtualResolver}                                       from './VirtualResolver';
import {WorkspaceFetcher}                                      from './WorkspaceFetcher';
import {WorkspaceResolver}                                     from './WorkspaceResolver';
import * as folderUtils                                        from './folderUtils';
import * as miscUtils                                          from './miscUtils';
import * as nodeUtils                                          from './nodeUtils';
import * as structUtils                                        from './structUtils';
import {IdentHash, Package, Descriptor}                        from './types';

// @ts-ignore
const ctx: any = new chalk.constructor({enabled: true});

const TAG_REGEXP = /^[a-z]+$/;

const IGNORED_ENV_VARIABLES = new Set([
  // "binFolder" is the magic location where the parent process stored the
  // current binaries; not an actual configuration settings
  `binFolder`,

  // "version" is set by Docker:
  // https://github.com/nodejs/docker-node/blob/5a6a5e91999358c5b04fddd6c22a9a4eb0bf3fbf/10/alpine/Dockerfile#L51
  `version`,

  // "flags" is set by Netlify; they use it to specify the flags to send to the
  // CLI when running the automatic `yarn install`
  `flags`,
]);

export const ENVIRONMENT_PREFIX = `yarn_`;
export const DEFAULT_RC_FILENAME = toFilename(`.yarnrc.yml`);
export const DEFAULT_LOCK_FILENAME = toFilename(`yarn.lock`);

export enum SettingsType {
  ANY = 'ANY',
  BOOLEAN = 'BOOLEAN',
  ABSOLUTE_PATH = 'ABSOLUTE_PATH',
  LOCATOR = 'LOCATOR',
  LOCATOR_LOOSE = 'LOCATOR_LOOSE',
  STRING = 'STRING',
  SECRET = 'SECRET',
  SHAPE = 'SHAPE',
  MAP = 'MAP',
};

export enum FormatType {
  NAME = 'NAME',
  NUMBER = 'NUMBER',
  PATH = 'PATH',
  RANGE = 'RANGE',
  REFERENCE = 'REFERENCE',
  SCOPE = 'SCOPE',
};

export const formatColors = new Map([
  [FormatType.NAME, `#d7875f`],
  [FormatType.RANGE, `#00afaf`],
  [FormatType.REFERENCE, `#87afff`],
  [FormatType.NUMBER, `yellow`],
  [FormatType.PATH, `cyan`],
  [FormatType.SCOPE, `#d75f00`],
]);

export type BaseSettingsDefinition<T extends SettingsType = SettingsType> = {
  description: string,
  type: T,
  isArray?: boolean,
};

export type ShapeSettingsDefinition = BaseSettingsDefinition<SettingsType.SHAPE> & {
  properties: {[propertyName: string]: SettingsDefinition},
};

export type MapSettingsDefinition = BaseSettingsDefinition<SettingsType.MAP> & {
  valueDefinition: SettingsDefinitionNoDefault,
};

export type SimpleSettingsDefinition = BaseSettingsDefinition<Exclude<SettingsType, SettingsType.SHAPE | SettingsType.MAP>> & {
  default: any,
  defaultText?: any,
  isNullable?: boolean,
};

export type SettingsDefinitionNoDefault =
  | MapSettingsDefinition
  | ShapeSettingsDefinition
  | Omit<SimpleSettingsDefinition, 'default'>;

export type SettingsDefinition =
  | MapSettingsDefinition
  | ShapeSettingsDefinition
  | SimpleSettingsDefinition;

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

  // Settings related to proxying all Yarn calls to a specific executable
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
    description: `Folder where the virtual packages (cf doc) will be mapped on the disk`,
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
    default: isCI,
    defaultText: `<dynamic>`,
  },
  enableProgressBars: {
    description: `If true, the CLI is allowed to show a progress bar for long-running events`,
    type: SettingsType.BOOLEAN,
    default: !isCI && process.stdout.isTTY,
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
  progressBarStyle: {
    description: `Which style of progress bar should be used (only when progress bars are enabled)`,
    type: SettingsType.STRING,
    default: undefined,
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
  enableTransparentWorkspaces: {
    description: `If false, Yarn won't automatically resolve workspace dependencies unless they use the \`workspace:\` protocol`,
    type: SettingsType.BOOLEAN,
    default: true,
  },

  // Settings related to network access
  enableMirror: {
    description: `If true, the downloaded packages will be retrieved and stored in both the local and global folders`,
    type: SettingsType.BOOLEAN,
    default: true,
  },
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
  unsafeHttpWhitelist: {
    description: `List of the hostnames for which http queries are allowed (glob patterns are supported)`,
    type: SettingsType.STRING,
    default: [],
    isArray: true,
  },

  // Settings related to security
  enableScripts: {
    description: `If true, packages are allowed to have install scripts by default`,
    type: SettingsType.BOOLEAN,
    default: true,
  },
  enableImmutableCache: {
    description: `If true, the cache is reputed immutable and actions that would modify it will throw`,
    type: SettingsType.BOOLEAN,
    default: false,
  },
  checksumBehavior: {
    description: `Enumeration defining what to do when a checksum doesn't match expectations`,
    type: SettingsType.STRING,
    default: `throw`,
  },

  // Package patching - to fix incorrect definitions
  packageExtensions: {
    description: `Map of package corrections to apply on the dependency tree`,
    type: SettingsType.MAP,
    valueDefinition: {
      description: ``,
      type: SettingsType.ANY,
    },
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
    case SettingsType.ANY:
      return value;
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
      return ppath.resolve(folder, npath.toPortablePath(value));
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

    // @ts-ignore: SettingsDefinitionNoDefault has ... no default ... but
    // that's fine because we're guaranteed it's not undefined.
    const valueDefinition: SettingsDefinition = definition.valueDefinition;

    result.set(propKey, parseValue(configuration, subPath, propValue, valueDefinition, folder));
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
    } break;

    case SettingsType.MAP: {
      return new Map<string, any>();
    } break;

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
    } break;

    default: {
      return definition.default;
    } break;
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

export enum ProjectLookup {
  LOCKFILE,
  MANIFEST,
  NONE,
};

export class Configuration {
  public startingCwd: PortablePath;
  public projectCwd: PortablePath | null;

  public plugins: Map<string, Plugin> = new Map();

  public settings: Map<string, SettingsDefinition> = new Map();
  public values: Map<string, any> = new Map();
  public sources: Map<string, string> = new Map();

  public invalid: Map<string, string> = new Map();

  private packageExtensions: Map<IdentHash, Array<{
    range: string,
    patch: (pkg: Package) => void,
  }>> = new Map();

  /**
   * Instantiate a new configuration object exposing the configuration obtained
   * from reading the various rc files and the environment settings.
   *
   * The `pluginConfiguration` parameter is expected to indicate:
   *
   * 1. which modules should be made available to plugins when they require a
   *    package (this is the dynamic linking part - for example we want all the
   *    plugins to use the exact same version of @yarnpkg/core, which also is the
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

  static async find(startingCwd: PortablePath, pluginConfiguration: PluginConfiguration | null, {lookup = ProjectLookup.LOCKFILE, strict = true, useRc = true}: {lookup?: ProjectLookup, strict?: boolean, useRc?: boolean} = {}) {
    const environmentSettings = getEnvironmentSettings();
    delete environmentSettings.rcFilename;

    const rcFiles = await Configuration.findRcFiles(startingCwd);
    const plugins = new Map();

    const interop = (obj: any) => obj.__esModule ? obj.default : obj;

    if (pluginConfiguration !== null) {
      for (const request of pluginConfiguration.plugins.keys())
        plugins.set(request, interop(pluginConfiguration.modules.get(request)));

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
          const pluginPath = ppath.resolve(cwd, npath.toPortablePath(userProvidedPath));
          const {factory, name} = nodeUtils.dynamicRequire(npath.fromPortablePath(pluginPath));

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

    let projectCwd: PortablePath | null;
    switch (lookup) {
      case ProjectLookup.LOCKFILE: {
        projectCwd = await Configuration.findProjectCwd(startingCwd, lockfileFilename);
      } break;

      case ProjectLookup.MANIFEST: {
        projectCwd = await Configuration.findProjectCwd(startingCwd, null);
      } break;

      case ProjectLookup.NONE: {
        if (xfs.existsSync(ppath.join(startingCwd, `package.json` as Filename))) {
          projectCwd = ppath.resolve(startingCwd);
        } else {
          projectCwd = null;
        }
      } break;
    }

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
            tip = ` (in particular, make sure you list the colons after each key name)`;

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

  static async findProjectCwd(startingCwd: PortablePath, lockfileFilename: Filename | null) {
    let projectCwd = null;

    let nextCwd = startingCwd;
    let currentCwd = null;

    while (nextCwd !== currentCwd) {
      currentCwd = nextCwd;

      if (xfs.existsSync(ppath.join(currentCwd, toFilename(`package.json`))))
        projectCwd = currentCwd;

      const topLevelFound = lockfileFilename !== null
        ? xfs.existsSync(ppath.join(currentCwd, lockfileFilename))
        : projectCwd !== null;

      if (topLevelFound)
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

  useWithSource(source: string, data: {[key: string]: unknown}, folder: PortablePath, {strict = true, overwrite = false}: {strict?: boolean, overwrite?: boolean}) {
    try {
      this.use(source, data, folder, {strict, overwrite});
    } catch (error) {
      error.message += ` (in ${source})`;
      throw error;
    }
  }

  use(source: string, data: {[key: string]: unknown}, folder: PortablePath, {strict = true, overwrite = false}: {strict?: boolean, overwrite?: boolean}) {
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
          throw new UsageError(`Unrecognized or legacy configuration settings found: ${key} - run "yarn config -v" to see the list of settings supported in Yarn`);
        } else {
          this.invalid.set(key, source);
          continue;
        }
      }

      if (this.sources.has(key) && !overwrite)
        continue;

      this.values.set(key, parseValue(this, key, data[key], definition, folder));
      this.sources.set(key, source);

      if (key === `packageExtensions`) {
        this.refreshPackageExtensions();
      }
    }
  }

  get<T = any>(key: string) {
    if (!this.values.has(key))
      throw new Error(`Invalid configuration key "${key}"`);

    return this.values.get(key) as T;
  }

  getSubprocessStreams(prefix: string, {header, report}: {header?: string, report: Report}) {
    let stdout: Writable;
    let stderr: Writable;

    const logFile = npath.toPortablePath(tmpNameSync({prefix: `logfile-`, postfix: `.log`}));
    const logStream = xfs.createWriteStream(logFile);

    if (this.get(`enableInlineBuilds`)) {
      const stdoutLineReporter = report.createStreamReporter(`${prefix} ${this.format(`STDOUT`, `green`)}`);
      const stderrLineReporter = report.createStreamReporter(`${prefix} ${this.format(`STDERR`, `red`)}`);

      stdout = new PassThrough();
      stdout.pipe(stdoutLineReporter);
      stdout.pipe(logStream);

      stderr = new PassThrough();
      stderr.pipe(stderrLineReporter);
      stderr.pipe(logStream);
    } else {
      stdout = logStream;
      stderr = logStream;

      if (typeof header !== `undefined`) {
        stdout.write(`${header}\n`);
      }
    }

    return {logFile, stdout, stderr};
  }

  makeResolver() {
    const pluginResolvers = [];

    for (const plugin of this.plugins.values())
      for (const resolver of plugin.resolvers || [])
        pluginResolvers.push(new resolver());

    return new MultiResolver([
      new VirtualResolver(),
      new WorkspaceResolver(),
      new ProtocolResolver(),

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

  refreshPackageExtensions() {
    this.packageExtensions = new Map();

    for (const [descriptorString, extensionData] of this.get<Map<string, any>>(`packageExtensions`)) {
      const descriptor = structUtils.parseDescriptor(descriptorString, true);
      if (!semver.validRange(descriptor.range))
        throw new Error(`Only semver ranges are allowed as keys for the lockfileExtensions setting`);

      const extension = new Manifest();
      extension.load(extensionData);

      miscUtils.getArrayWithDefault(this.packageExtensions, descriptor.identHash).push({
        range: descriptor.range,
        patch: pkg => {
          pkg.dependencies = new Map([...pkg.dependencies, ...extension.dependencies]);
          pkg.peerDependencies = new Map([...pkg.peerDependencies, ...extension.peerDependencies]);
          pkg.dependenciesMeta = new Map([...pkg.dependenciesMeta, ...extension.dependenciesMeta]);
          pkg.peerDependenciesMeta = new Map([...pkg.peerDependenciesMeta, ...extension.peerDependenciesMeta]);
        },
      });
    }
  }

  normalizeDescriptor(original: Descriptor) {
    const defaultProtocol = this.get<string>(`defaultProtocol`);

    if (semver.validRange(original.range) || TAG_REGEXP.test(original.range)) {
      return structUtils.makeDescriptor(original, `${defaultProtocol}${original.range}`);
    } else {
      return original;
    }
  }

  normalizePackage(original: Package) {
    const pkg = structUtils.copyPackage(original);

    // We use the extensions to define additional dependencies that weren't
    // properly listed in the original package definition

    const extensionList = this.packageExtensions.get(original.identHash);
    if (typeof extensionList !== `undefined`) {
      const version = original.version;

      if (version !== null) {
        const extensionEntry = extensionList.find(({range}) => {
          return semver.satisfies(version, range);
        });

        if (typeof extensionEntry !== `undefined`) {
          extensionEntry.patch(pkg);
        }
      }
    }

    // We sort the dependencies so that further iterations always occur in the
    // same order, regardless how the various registries formatted their output

    pkg.dependencies = new Map(miscUtils.sortMap(pkg.dependencies, ([, descriptor]) => descriptor.name));
    pkg.peerDependencies = new Map(miscUtils.sortMap(pkg.peerDependencies, ([, descriptor]) => descriptor.name));

    return pkg;
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

  async reduceHook<U extends any[], V, HooksDefinition = Hooks>(get: (hooks: HooksDefinition) => ((reduced: V, ...args: U) => Promise<V>) | undefined, initialValue: V, ...args: U): Promise<V> {
    let value = initialValue;

    for (const plugin of this.plugins.values()) {
      const hooks = plugin.hooks as HooksDefinition;
      if (!hooks)
        continue;

      const hook = get(hooks);
      if (!hook)
        continue;

      value = await hook(value, ...args);
    }

    return value;
  }

  format(text: string, colorRequest: FormatType | string) {
    if (!this.get(`enableColors`))
      return text;

    let color = formatColors.get(colorRequest as FormatType);
    if (typeof color === `undefined`)
      color = colorRequest;

    const fn = color.startsWith(`#`)
      ? ctx.hex(color)
      : ctx[color];

    return fn(text);
  }
}
