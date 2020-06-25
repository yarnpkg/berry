import {DEFAULT_COMPRESSION_LEVEL}                             from '@yarnpkg/fslib';
import {Filename, PortablePath, npath, ppath, toFilename, xfs} from '@yarnpkg/fslib';
import {parseSyml, stringifySyml}                              from '@yarnpkg/parsers';
import camelcase                                               from 'camelcase';
import chalk                                                   from 'chalk';
import {isCI}                                                  from 'ci-info';
import {UsageError}                                            from 'clipanion';
import semver                                                  from 'semver';
import {PassThrough, Writable}                                 from 'stream';

import {CorePlugin}                                            from './CorePlugin';
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
import * as semverUtils                                        from './semverUtils';
import * as structUtils                                        from './structUtils';
import {IdentHash, Package, Descriptor}                        from './types';

const chalkOptions = process.env.GITHUB_ACTIONS
  ? {level: 2}
  : chalk.supportsColor
    ? {level: chalk.supportsColor.level}
    : {level: 0};

const supportsColor = chalkOptions.level !== 0;
const supportsHyperlinks = supportsColor && !process.env.GITHUB_ACTIONS;

const chalkInstance = new chalk.Instance(chalkOptions);

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

  // "gpg" and "profile" are used by the install.sh script:
  // https://classic.yarnpkg.com/install.sh
  `profile`,
  `gpg`,

  // "wrapOutput" was a variable used to indicate nested "yarn run" processes
  // back in Yarn 1.
  `wrapOutput`,
]);

export const ENVIRONMENT_PREFIX = `yarn_`;
export const DEFAULT_RC_FILENAME = toFilename(`.yarnrc.yml`);
export const DEFAULT_LOCK_FILENAME = toFilename(`yarn.lock`);
export const SECRET = `********`;

export enum SettingsType {
  ANY = `ANY`,
  BOOLEAN = `BOOLEAN`,
  ABSOLUTE_PATH = `ABSOLUTE_PATH`,
  LOCATOR = `LOCATOR`,
  LOCATOR_LOOSE = `LOCATOR_LOOSE`,
  NUMBER = `NUMBER`,
  STRING = `STRING`,
  SECRET = `SECRET`,
  SHAPE = `SHAPE`,
  MAP = `MAP`,
}

export enum FormatType {
  NAME = `NAME`,
  NUMBER = `NUMBER`,
  PATH = `PATH`,
  RANGE = `RANGE`,
  REFERENCE = `REFERENCE`,
  SCOPE = `SCOPE`,
  ADDED = `ADDED`,
  REMOVED = `REMOVED`,
}

export const formatColors = chalkOptions.level >= 3 ? new Map([
  [FormatType.NAME, `#d7875f`],
  [FormatType.RANGE, `#00afaf`],
  [FormatType.REFERENCE, `#87afff`],
  [FormatType.NUMBER, `#ffd700`],
  [FormatType.PATH, `#d75fd7`],
  [FormatType.SCOPE, `#d75f00`],
  [FormatType.ADDED, `#5faf00`],
  [FormatType.REMOVED, `#d70000`],
]) : new Map([
  [FormatType.NAME, 173],
  [FormatType.RANGE, 37],
  [FormatType.REFERENCE, 111],
  [FormatType.NUMBER, 220],
  [FormatType.PATH, 170],
  [FormatType.SCOPE, 166],
  [FormatType.ADDED, 70],
  [FormatType.REMOVED, 160],
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
  normalizeKeys?: (key: string) => string,
};

export type SimpleSettingsDefinition = BaseSettingsDefinition<Exclude<SettingsType, SettingsType.SHAPE | SettingsType.MAP>> & {
  default: any,
  defaultText?: any,
  isNullable?: boolean,
  values?: Array<any>,
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
  ignoreCwd: {
    description: `If true, the \`--cwd\` flag will be ignored`,
    type: SettingsType.BOOLEAN,
    default: false,
  },

  // Settings related to the package manager internal names
  cacheKeyOverride: {
    description: `A global cache key override; used only for test purposes`,
    type: SettingsType.STRING,
    default: null,
  },
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
  compressionLevel: {
    description: `Zip files compression level, from 0 to 9 or mixed (a variant of 9, which stores some files uncompressed, when compression doesn't yield good results)`,
    type: SettingsType.NUMBER,
    values: [`mixed`, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    default: DEFAULT_COMPRESSION_LEVEL,
  },
  virtualFolder: {
    description: `Folder where the virtual packages (cf doc) will be mapped on the disk (must be named $$virtual)`,
    type: SettingsType.ABSOLUTE_PATH,
    default: `./.yarn/$$virtual`,
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
  installStatePath: {
    description: `Path of the file where the install state will be persisted`,
    type: SettingsType.ABSOLUTE_PATH,
    default: `./.yarn/install-state.gz`,
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
    default: supportsColor,
    defaultText: `<dynamic>`,
  },
  enableHyperlinks: {
    description: `If true, the CLI is allowed to use hyperlinks in its output`,
    type: SettingsType.BOOLEAN,
    default: supportsHyperlinks,
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
    default: !isCI && process.stdout.isTTY && process.stdout.columns > 22,
    defaultText: `<dynamic>`,
  },
  enableTimers: {
    description: `If true, the CLI is allowed to print the time spent executing commands`,
    type: SettingsType.BOOLEAN,
    default: true,
  },
  preferAggregateCacheInfo: {
    description: `If true, the CLI will only print a one-line report of any cache changes`,
    type: SettingsType.BOOLEAN,
    default: isCI,
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
  httpTimeout: {
    description: `Timeout of each http request in milliseconds`,
    type: SettingsType.NUMBER,
    default: 60000,
  },
  httpRetry: {
    description: `Retry times on http failure`,
    type: SettingsType.NUMBER,
    default: 3,
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
      return String(value).split(/,/).map(segment => {
        return parseSingleValue(configuration, path, segment, definition, folder);
      });
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

  if (definition.values?.includes(value))
    return value;

  const interpretValue = () => {
    if (definition.type === SettingsType.BOOLEAN)
      return parseBoolean(value);

    if (typeof value !== `string`)
      throw new Error(`Expected value (${value}) to be a string`);

    const valueWithReplacedVariables = miscUtils.replaceEnvVariables(value, {
      env: process.env,
    });

    switch (definition.type) {
      case SettingsType.ABSOLUTE_PATH:
        return ppath.resolve(folder, npath.toPortablePath(valueWithReplacedVariables));
      case SettingsType.LOCATOR_LOOSE:
        return structUtils.parseLocator(valueWithReplacedVariables, false);
      case SettingsType.NUMBER:
        return parseInt(valueWithReplacedVariables);
      case SettingsType.LOCATOR:
        return structUtils.parseLocator(valueWithReplacedVariables);
      default:
        return valueWithReplacedVariables;
    }
  };

  const interpreted = interpretValue();

  if (definition.values && !definition.values.includes(interpreted))
    throw new Error(`Invalid value, expected one of ${definition.values.join(`, `)}`);

  return interpreted;
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

  if (typeof value !== `object` || Array.isArray(value))
    throw new UsageError(`Map configuration settings "${path}" must be an object`);

  if (value === null)
    return result;

  for (const [propKey, propValue] of Object.entries(value)) {
    const normalizedKey = definition.normalizeKeys? definition.normalizeKeys(propKey) : propKey;
    const subPath = `${path}['${normalizedKey}']`;

    // @ts-ignore: SettingsDefinitionNoDefault has ... no default ... but
    // that's fine because we're guaranteed it's not undefined.
    const valueDefinition: SettingsDefinition = definition.valueDefinition;

    result.set(normalizedKey, parseValue(configuration, subPath, propValue, valueDefinition, folder));
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
        } else if (definition.isNullable) {
          return null;
        } else {
          // Reached when a relative path is the default but the current
          // context is evaluated outside of a Yarn project
          return undefined;
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

type SettingTransforms = {
  hideSecrets: boolean;
  getNativePaths: boolean;
};

function transformConfiguration(rawValue: unknown, definition: SettingsDefinitionNoDefault, transforms: SettingTransforms) {
  if (definition.type === SettingsType.SECRET && typeof rawValue === `string` && transforms.hideSecrets)
    return SECRET;
  if (definition.type === SettingsType.ABSOLUTE_PATH && typeof rawValue === `string` && transforms.getNativePaths)
    return npath.fromPortablePath(rawValue);

  if (definition.isArray && Array.isArray(rawValue)) {
    const newValue: Array<unknown> = [];

    for (const value of rawValue)
      newValue.push(transformConfiguration(value, definition, transforms));

    return newValue;
  }

  if (definition.type === SettingsType.MAP && rawValue instanceof Map) {
    const newValue: Map<string, unknown> = new Map();

    for (const [key, value] of rawValue.entries())
      newValue.set(key, transformConfiguration(value, definition.valueDefinition, transforms));

    return newValue;
  }

  if (definition.type === SettingsType.SHAPE && rawValue instanceof Map) {
    const newValue: Map<string, unknown> = new Map();

    for (const [key, value] of rawValue.entries()) {
      const propertyDefinition = definition.properties[key];
      newValue.set(key, transformConfiguration(value, propertyDefinition, transforms));
    }

    return newValue;
  }

  return rawValue;
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
    if (key.toLowerCase() === rcKey && typeof value === `string`)
      return value as Filename;

  return DEFAULT_RC_FILENAME as Filename;
}

export enum ProjectLookup {
  LOCKFILE,
  MANIFEST,
  NONE,
}

export type FindProjectOptions = {
  lookup?: ProjectLookup,
  strict?: boolean,
  usePath?: boolean,
  useRc?: boolean,
};

export class Configuration {
  public startingCwd: PortablePath;
  public projectCwd: PortablePath | null = null;

  public plugins: Map<string, Plugin> = new Map();

  public settings: Map<string, SettingsDefinition> = new Map();
  public values: Map<string, any> = new Map();
  public sources: Map<string, string> = new Map();

  public invalid: Map<string, string> = new Map();

  private packageExtensions?: Map<IdentHash, Array<{
    range: string,
    patch: (pkg: Package) => void,
  }>> = new Map();

  /**
   * Instantiate a new configuration object with the default values from the
   * core. You typically don't want to use this, as it will ignore the values
   * configured in the rc files. Instead, prefer to use `Configuration#find`.
   */

  static create(startingCwd: PortablePath, plugins?: Map<string, Plugin>): Configuration;
  static create(startingCwd: PortablePath, projectCwd: PortablePath | null, plugins?: Map<string, Plugin>): Configuration;
  static create(startingCwd: PortablePath, projectCwdOrPlugins?: Map<string, Plugin> | PortablePath | null, maybePlugins?: Map<string, Plugin>) {
    const configuration = new Configuration(startingCwd);

    if (typeof projectCwdOrPlugins !== `undefined` && !(projectCwdOrPlugins instanceof Map))
      configuration.projectCwd = projectCwdOrPlugins;

    configuration.importSettings(coreDefinitions);

    const plugins = typeof maybePlugins !== `undefined`
      ? maybePlugins
      : projectCwdOrPlugins instanceof Map
        ? projectCwdOrPlugins
        : new Map();

    for (const [name, plugin] of plugins)
      configuration.activatePlugin(name, plugin);

    return configuration;
  }

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

  static async find(startingCwd: PortablePath, pluginConfiguration: PluginConfiguration | null, {lookup = ProjectLookup.LOCKFILE, strict = true, usePath = false, useRc = true}: FindProjectOptions = {}) {
    const environmentSettings = getEnvironmentSettings();
    delete environmentSettings.rcFilename;

    const rcFiles = await Configuration.findRcFiles(startingCwd);
    const homeRcFile = await Configuration.findHomeRcFile();

    // First we will parse the `yarn-path` settings. Doing this now allows us
    // to not have to load the plugins if there's a `yarn-path` configured.

    type CoreKeys = keyof typeof coreDefinitions;
    type CoreFields = {[key in CoreKeys]: any};

    const pickCoreFields = ({ignoreCwd, yarnPath, ignorePath, lockfileFilename}: CoreFields) => ({ignoreCwd, yarnPath, ignorePath, lockfileFilename});
    const excludeCoreFields = ({ignoreCwd, yarnPath, ignorePath, lockfileFilename, ...rest}: CoreFields) => rest;

    const configuration = new Configuration(startingCwd);
    configuration.importSettings(pickCoreFields(coreDefinitions));

    configuration.useWithSource(`<environment>`, pickCoreFields(environmentSettings), startingCwd, {strict: false});
    for (const {path, cwd, data} of rcFiles)
      configuration.useWithSource(path, pickCoreFields(data), cwd, {strict: false});
    if (homeRcFile)
      configuration.useWithSource(homeRcFile.path, pickCoreFields(homeRcFile.data), homeRcFile.cwd, {strict: false});

    if (usePath) {
      const yarnPath: PortablePath = configuration.get<PortablePath>(`yarnPath`);
      const ignorePath = configuration.get<boolean>(`ignorePath`);

      if (yarnPath !== null && !ignorePath) {
        return configuration;
      }
    }

    // We need to know the project root before being able to truly instantiate
    // our configuration, and to know that we need to know the lockfile name

    const lockfileFilename = configuration.get<Filename>(`lockfileFilename`);

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

    // Great! We now have enough information to really start to setup the
    // core configuration object.

    configuration.startingCwd = startingCwd;
    configuration.projectCwd = projectCwd;

    configuration.importSettings(excludeCoreFields(coreDefinitions));

    // Now that the configuration object is almost ready, we need to load all
    // the configured plugins

    const plugins = new Map<string, Plugin>([
      [`@@core`, CorePlugin],
    ]);

    const interop =
      (obj: any) => obj.__esModule
        ? obj.default
        : obj;

    if (pluginConfiguration !== null) {
      for (const request of pluginConfiguration.plugins.keys())
        plugins.set(request, interop(pluginConfiguration.modules.get(request)));

      const requireEntries = new Map();
      for (const request of nodeUtils.builtinModules())
        requireEntries.set(request, () => nodeUtils.dynamicRequire(request));
      for (const [request, embedModule] of pluginConfiguration.modules)
        requireEntries.set(request, () => embedModule);

      const dynamicPlugins = new Set();

      const getDefault = (object: any) => {
        return object.default || object;
      };

      const importPlugin = (pluginPath: PortablePath, source: string) => {
        const {factory, name} = nodeUtils.dynamicRequire(npath.fromPortablePath(pluginPath));

        // Prevent plugin redefinition so that the ones declared deeper in the
        // filesystem always have precedence over the ones below.
        if (dynamicPlugins.has(name))
          return;

        const pluginRequireEntries = new Map(requireEntries);
        const pluginRequire = (request: string) => {
          if (pluginRequireEntries.has(request)) {
            return pluginRequireEntries.get(request)();
          } else {
            throw new UsageError(`This plugin cannot access the package referenced via ${request} which is neither a builtin, nor an exposed entry`);
          }
        };

        const plugin = miscUtils.prettifySyncErrors(() => {
          return getDefault(factory(pluginRequire));
        }, message => {
          return `${message} (when initializing ${name}, defined in ${source})`;
        });

        requireEntries.set(name, () => plugin);

        dynamicPlugins.add(name);
        plugins.set(name, plugin);
      };

      if (environmentSettings.plugins) {
        for (const userProvidedPath of environmentSettings.plugins.split(`;`)) {
          const pluginPath = ppath.resolve(startingCwd, npath.toPortablePath(userProvidedPath));
          importPlugin(pluginPath, `<environment>`);
        }
      }

      for (const {path, cwd, data} of rcFiles) {
        if (!useRc)
          continue;
        if (!Array.isArray(data.plugins))
          continue;

        for (const userPluginEntry of data.plugins) {
          const userProvidedPath = typeof userPluginEntry !== `string`
            ? userPluginEntry.path
            : userPluginEntry;

          const pluginPath = ppath.resolve(cwd, npath.toPortablePath(userProvidedPath));
          importPlugin(pluginPath, path);
        }
      }
    }

    for (const [name, plugin] of plugins)
      configuration.activatePlugin(name, plugin);

    configuration.useWithSource(`<environment>`, excludeCoreFields(environmentSettings), startingCwd, {strict});
    for (const {path, cwd, data} of rcFiles)
      configuration.useWithSource(path, excludeCoreFields(data), cwd, {strict});
    if (homeRcFile)
      configuration.useWithSource(homeRcFile.path, excludeCoreFields(homeRcFile.data), homeRcFile.cwd, {strict});

    if (configuration.get(`enableGlobalCache`)) {
      configuration.values.set(`cacheFolder`, `${configuration.get(`globalFolder`)}/cache`);
      configuration.sources.set(`cacheFolder`, `<internal>`);
    }

    await configuration.refreshPackageExtensions();

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

  static async findHomeRcFile() {
    const rcFilename = getRcFilename();

    const homeFolder = folderUtils.getHomeFolder();
    const homeRcFilePath = ppath.join(homeFolder, rcFilename);

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

      if (lockfileFilename !== null) {
        if (xfs.existsSync(ppath.join(currentCwd, lockfileFilename))) {
          projectCwd = currentCwd;
          break;
        }
      } else {
        if (projectCwd !== null) {
          break;
        }
      }

      nextCwd = ppath.dirname(currentCwd);
    }

    return projectCwd;
  }

  static async updateConfiguration(cwd: PortablePath, patch: {[key: string]: any} | ((current: any) => any)) {
    const rcFilename = getRcFilename();
    const configurationPath =  ppath.join(cwd, rcFilename as PortablePath);

    const current = xfs.existsSync(configurationPath)
      ? parseSyml(await xfs.readFilePromise(configurationPath, `utf8`)) as any
      : {};

    let patched = false;

    if (typeof patch === `function`)
      patch = patch(current);
    if (typeof patch === `function`)
      throw new Error(`Assertion failed: Invalid configuration type`);

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

    await xfs.changeFilePromise(configurationPath, stringifySyml(current), {
      automaticNewlines: true,
    });
  }

  static async updateHomeConfiguration(patch: {[key: string]: any} | ((current: any) => any)) {
    const homeFolder = folderUtils.getHomeFolder();

    return await Configuration.updateConfiguration(homeFolder, patch);
  }

  private constructor(startingCwd: PortablePath) {
    this.startingCwd = startingCwd;
  }

  activatePlugin(name: string, plugin: Plugin) {
    this.plugins.set(name, plugin);

    if (typeof plugin.configuration !== `undefined`) {
      this.importSettings(plugin.configuration);
    }
  }

  private importSettings(definitions: {[name: string]: SettingsDefinition}) {
    for (const [name, definition] of Object.entries(definitions)) {
      if (this.settings.has(name))
        throw new Error(`Cannot redefine settings "${name}"`);

      this.settings.set(name, definition);
      this.values.set(name, getDefaultValue(this, definition));
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
      const value = data[key];
      if (typeof value === `undefined`)
        continue;

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

      let parsed;
      try {
        parsed = parseValue(this, key, data[key], definition, folder);
      } catch (error) {
        error.message += ` in ${source}`;
        throw error;
      }

      this.values.set(key, parsed);
      this.sources.set(key, source);
    }
  }

  get<T = any>(key: string) {
    if (!this.values.has(key))
      throw new Error(`Invalid configuration key "${key}"`);

    return this.values.get(key) as T;
  }

  getSpecial<T = any>(key: string, {hideSecrets = false, getNativePaths = false}: Partial<SettingTransforms>) {
    const rawValue = this.get(key);
    const definition = this.settings.get(key);

    if (typeof definition === `undefined`)
      throw new UsageError(`Couldn't find a configuration settings named "${key}"`);

    return transformConfiguration(rawValue, definition, {
      hideSecrets,
      getNativePaths,
    }) as T;
  }

  getSubprocessStreams(logFile: PortablePath, {header, prefix, report}: {header?: string, prefix: string, report: Report}) {
    let stdout: Writable;
    let stderr: Writable;

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

    return {stdout, stderr};
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

  async refreshPackageExtensions() {
    this.packageExtensions = new Map();
    const packageExtensions = this.packageExtensions;

    const registerPackageExtension = (descriptor: Descriptor, extensionData: any) => {
      if (!semver.validRange(descriptor.range))
        throw new Error(`Only semver ranges are allowed as keys for the lockfileExtensions setting`);

      const extension = new Manifest();
      extension.load(extensionData);

      miscUtils.getArrayWithDefault(packageExtensions, descriptor.identHash).push({
        range: descriptor.range,
        patch: pkg => {
          pkg.dependencies = new Map([...pkg.dependencies, ...extension.dependencies]);
          pkg.peerDependencies = new Map([...pkg.peerDependencies, ...extension.peerDependencies]);
          pkg.dependenciesMeta = new Map([...pkg.dependenciesMeta, ...extension.dependenciesMeta]);
          pkg.peerDependenciesMeta = new Map([...pkg.peerDependenciesMeta, ...extension.peerDependenciesMeta]);
        },
      });
    };

    for (const [descriptorString, extensionData] of this.get<Map<string, any>>(`packageExtensions`))
      registerPackageExtension(structUtils.parseDescriptor(descriptorString, true), extensionData);

    await this.triggerHook(hooks => {
      return hooks.registerPackageExtensions;
    }, this, registerPackageExtension);
  }

  normalizePackage(original: Package) {
    const pkg = structUtils.copyPackage(original);

    // We use the extensions to define additional dependencies that weren't
    // properly listed in the original package definition

    if (this.packageExtensions == null)
      throw new Error(`refreshPackageExtensions has to be called before normalizing packages`);

    const extensionList = this.packageExtensions.get(original.identHash);
    if (typeof extensionList !== `undefined`) {
      const version = original.version;

      if (version !== null) {
        const extensionEntry = extensionList.find(({range}) => {
          return semverUtils.satisfiesWithPrereleases(version, range);
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

  async triggerHook<U extends Array<any>, V, HooksDefinition = Hooks>(get: (hooks: HooksDefinition) => ((...args: U) => V) | undefined, ...args: U): Promise<void> {
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

  async triggerMultipleHooks<U extends Array<any>, V, HooksDefinition = Hooks>(get: (hooks: HooksDefinition) => ((...args: U) => V) | undefined, argsList: Array<U>): Promise<void> {
    for (const args of argsList) {
      await this.triggerHook(get, ...args);
    }
  }

  async reduceHook<U extends Array<any>, V, HooksDefinition = Hooks>(get: (hooks: HooksDefinition) => ((reduced: V, ...args: U) => Promise<V>) | undefined, initialValue: V, ...args: U): Promise<V> {
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

  async firstHook<U extends Array<any>, V, HooksDefinition = Hooks>(get: (hooks: HooksDefinition) => ((...args: U) => Promise<V>) | undefined, ...args: U): Promise<Exclude<V, void> | null> {
    for (const plugin of this.plugins.values()) {
      const hooks = plugin.hooks as HooksDefinition;
      if (!hooks)
        continue;

      const hook = get(hooks);
      if (!hook)
        continue;

      const ret = await hook(...args);
      if (typeof ret !== `undefined`) {
        // @ts-ignore
        return ret;
      }
    }

    return null;
  }

  format(text: string, colorRequest: FormatType | string) {
    if (colorRequest === FormatType.PATH)
      text = npath.fromPortablePath(text);

    if (!this.get(`enableColors`))
      return text;

    let color = formatColors.get(colorRequest as FormatType);
    if (typeof color === `undefined`)
      color = colorRequest;

    const fn = typeof color === `number`
      ? chalkInstance.ansi256(color)
      : color.startsWith(`#`)
        ? chalkInstance.hex(color)
        : (chalkInstance as any)[color];

    return fn(text);
  }
}
