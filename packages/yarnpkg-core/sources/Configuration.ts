import {Filename, PortablePath, npath, ppath, xfs}                                                      from '@yarnpkg/fslib';
import {DEFAULT_COMPRESSION_LEVEL}                                                                      from '@yarnpkg/fslib';
import {parseSyml, stringifySyml}                                                                       from '@yarnpkg/parsers';
import camelcase                                                                                        from 'camelcase';
import {isCI}                                                                                           from 'ci-info';
import {UsageError}                                                                                     from 'clipanion';
import pLimit, {Limit}                                                                                  from 'p-limit';
import {PassThrough, Writable}                                                                          from 'stream';

import {CorePlugin}                                                                                     from './CorePlugin';
import {Manifest, PeerDependencyMeta}                                                                   from './Manifest';
import {MultiFetcher}                                                                                   from './MultiFetcher';
import {MultiResolver}                                                                                  from './MultiResolver';
import {Plugin, Hooks}                                                                                  from './Plugin';
import {ProtocolResolver}                                                                               from './ProtocolResolver';
import {Report}                                                                                         from './Report';
import {TelemetryManager}                                                                               from './TelemetryManager';
import {VirtualFetcher}                                                                                 from './VirtualFetcher';
import {VirtualResolver}                                                                                from './VirtualResolver';
import {WorkspaceFetcher}                                                                               from './WorkspaceFetcher';
import {WorkspaceResolver}                                                                              from './WorkspaceResolver';
import * as folderUtils                                                                                 from './folderUtils';
import * as formatUtils                                                                                 from './formatUtils';
import * as miscUtils                                                                                   from './miscUtils';
import * as nodeUtils                                                                                   from './nodeUtils';
import * as semverUtils                                                                                 from './semverUtils';
import * as structUtils                                                                                 from './structUtils';
import {IdentHash, Package, Descriptor, PackageExtension, PackageExtensionType, PackageExtensionStatus} from './types';

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

  // "ignoreNode" is used to disable the Node version check
  `ignoreNode`,

  // "wrapOutput" was a variable used to indicate nested "yarn run" processes
  // back in Yarn 1.
  `wrapOutput`,

  // "YARN_HOME" and "YARN_CONF_DIR" may be present as part of the unrelated "Apache Hadoop YARN" software project.
  // https://hadoop.apache.org/docs/r0.23.11/hadoop-project-dist/hadoop-common/SingleCluster.html
  `home`,
  `confDir`,
]);

export const ENVIRONMENT_PREFIX = `yarn_`;
export const DEFAULT_RC_FILENAME = `.yarnrc.yml` as Filename;
export const DEFAULT_LOCK_FILENAME = `yarn.lock` as Filename;
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

export type FormatType = formatUtils.Type;
export const FormatType = formatUtils.Type;

export type BaseSettingsDefinition<T extends SettingsType = SettingsType> = {
  description: string,
  type: T,
} & ({isArray?: false} | {isArray: true, concatenateValues?: boolean});

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
    description: `Folder where the virtual packages (cf doc) will be mapped on the disk (must be named __virtual__)`,
    type: SettingsType.ABSOLUTE_PATH,
    default: `./.yarn/__virtual__`,
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
  immutablePatterns: {
    description: `Array of glob patterns; files matching them won't be allowed to change during immutable installs`,
    type: SettingsType.STRING,
    default: [],
    isArray: true,
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

  // Settings related to the output style
  enableColors: {
    description: `If true, the CLI is allowed to use colors in its output`,
    type: SettingsType.BOOLEAN,
    default: formatUtils.supportsColor,
    defaultText: `<dynamic>`,
  },
  enableHyperlinks: {
    description: `If true, the CLI is allowed to use hyperlinks in its output`,
    type: SettingsType.BOOLEAN,
    default: formatUtils.supportsHyperlinks,
    defaultText: `<dynamic>`,
  },
  enableInlineBuilds: {
    description: `If true, the CLI will print the build output on the command line`,
    type: SettingsType.BOOLEAN,
    default: isCI,
    defaultText: `<dynamic>`,
  },
  enableMessageNames: {
    description: `If true, the CLI will prefix most messages with codes suitable for search engines`,
    type: SettingsType.BOOLEAN,
    default: true,
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
  preferTruncatedLines: {
    description: `If true, the CLI will truncate lines that would go beyond the size of the terminal`,
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
  networkConcurrency: {
    description: `Maximal number of concurrent requests`,
    type: SettingsType.NUMBER,
    default: Infinity,
  },
  networkSettings: {
    description: `Network settings per hostname (glob patterns are supported)`,
    type: SettingsType.MAP,
    valueDefinition: {
      description: ``,
      type: SettingsType.SHAPE,
      properties: {
        caFilePath: {
          description: `Path to file containing one or multiple Certificate Authority signing certificates`,
          type: SettingsType.ABSOLUTE_PATH,
          default: null,
        },
        enableNetwork: {
          description: `If false, the package manager will refuse to use the network if required to`,
          type: SettingsType.BOOLEAN,
          default: null,
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
      },
    },
  },
  caFilePath: {
    description: `A path to a file containing one or multiple Certificate Authority signing certificates`,
    type: SettingsType.ABSOLUTE_PATH,
    default: null,
  },
  enableStrictSsl: {
    description: `If false, SSL certificate errors will be ignored`,
    type: SettingsType.BOOLEAN,
    default: true,
  },

  logFilters: {
    description: `Overrides for log levels`,
    type: SettingsType.SHAPE,
    isArray: true,
    concatenateValues: true,
    properties: {
      code: {
        description: `Code of the messages covered by this override`,
        type: SettingsType.STRING,
        default: undefined,
      },
      text: {
        description: `Code of the texts covered by this override`,
        type: SettingsType.STRING,
        default: undefined,
      },
      pattern: {
        description: `Code of the patterns covered by this override`,
        type: SettingsType.STRING,
        default: undefined,
      },
      level: {
        description: `Log level override, set to null to remove override`,
        type: SettingsType.STRING,
        values: Object.values(formatUtils.LogLevel),
        isNullable: true,
        default: undefined,
      },
    },
  },

  // Settings related to telemetry
  enableTelemetry: {
    description: `If true, telemetry will be periodically sent, following the rules in https://yarnpkg.com/advanced/telemetry`,
    type: SettingsType.BOOLEAN,
    default: true,
  },
  telemetryInterval: {
    description: `Minimal amount of time between two telemetry uploads, in days`,
    type: SettingsType.NUMBER,
    default: 7,
  },
  telemetryUserId: {
    description: `If you desire to tell us which project you are, you can set this field. Completely optional and opt-in.`,
    type: SettingsType.STRING,
    default: null,
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
      description: `The extension that will be applied to any package whose version matches the specified range`,
      type: SettingsType.SHAPE,
      properties: {
        dependencies: {
          description: `The set of dependencies that must be made available to the current package in order for it to work properly`,
          type: SettingsType.MAP,
          valueDefinition: {
            description: `A range`,
            type: SettingsType.STRING,
          },
        },
        peerDependencies: {
          description: `Inherited dependencies - the consumer of the package will be tasked to provide them`,
          type: SettingsType.MAP,
          valueDefinition: {
            description: `A semver range`,
            type: SettingsType.STRING,
          },
        },
        peerDependenciesMeta: {
          description: `Extra information related to the dependencies listed in the peerDependencies field`,
          type: SettingsType.MAP,
          valueDefinition: {
            description: `The peerDependency meta`,
            type: SettingsType.SHAPE,
            properties: {
              optional: {
                description: `If true, the selected peer dependency will be marked as optional by the package manager and the consumer omitting it won't be reported as an error`,
                type: SettingsType.BOOLEAN,
                default: false,
              },
            },
          },
        },
      },
    },
  },
};

/**
 * @deprecated Use miscUtils.ToMapValue
 */
export type MapConfigurationValue<T extends object> = miscUtils.ToMapValue<T>;

export interface ConfigurationValueMap {
  lastUpdateCheck: string | null;

  yarnPath: PortablePath;
  ignorePath: boolean;
  ignoreCwd: boolean;

  cacheKeyOverride: string | null;
  globalFolder: PortablePath;
  cacheFolder: PortablePath;
  compressionLevel: `mixed` | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  virtualFolder: PortablePath;
  lockfileFilename: Filename;
  installStatePath: PortablePath;
  immutablePatterns: Array<string>;
  rcFilename: Filename;
  enableGlobalCache: boolean;

  enableColors: boolean;
  enableHyperlinks: boolean;
  enableInlineBuilds: boolean;
  enableProgressBars: boolean;
  enableTimers: boolean;
  preferAggregateCacheInfo: boolean;
  preferInteractive: boolean;
  preferTruncatedLines: boolean;
  progressBarStyle: string | undefined;

  defaultLanguageName: string;
  defaultProtocol: string;
  enableTransparentWorkspaces: boolean;

  enableMirror: boolean;
  enableNetwork: boolean;
  httpProxy: string | null;
  httpsProxy: string | null;
  unsafeHttpWhitelist: Array<string>;
  httpTimeout: number;
  httpRetry: number;
  networkConcurrency: number;
  networkSettings: Map<string, miscUtils.ToMapValue<{
    caFilePath: PortablePath | null;
    enableNetwork: boolean | null;
    httpProxy: string | null;
    httpsProxy: string | null;
  }>>;
  caFilePath: PortablePath | null;
  enableStrictSsl: boolean;

  logFilters: Array<miscUtils.ToMapValue<{code?: string, text?: string, pattern?: string, level?: formatUtils.LogLevel | null}>>;

  // Settings related to telemetry
  enableTelemetry: boolean;
  telemetryInterval: number;
  telemetryUserId: string | null;

  // Settings related to security
  enableScripts: boolean;
  enableImmutableCache: boolean;
  checksumBehavior: string;

  // Package patching - to fix incorrect definitions
  packageExtensions: Map<string, miscUtils.ToMapValue<{
    dependencies?: Map<string, string>,
    peerDependencies?: Map<string, string>,
    peerDependenciesMeta?: Map<string, miscUtils.ToMapValue<{optional?: boolean}>>,
  }>>;
}

export type PackageExtensionData = miscUtils.MapValueToObjectValue<miscUtils.MapValue<ConfigurationValueMap['packageExtensions']>>;

type SimpleDefinitionForType<T> = SimpleSettingsDefinition & {
  type:
  | (T extends boolean ? SettingsType.BOOLEAN : never)
  | (T extends number ? SettingsType.NUMBER : never)
  | (T extends PortablePath ? SettingsType.ABSOLUTE_PATH : never)
  | (T extends string ? SettingsType.LOCATOR | SettingsType.LOCATOR_LOOSE | SettingsType.SECRET | SettingsType.STRING : never)
  | SettingsType.ANY
  ;
};

type DefinitionForTypeHelper<T> = T extends Map<string, infer U>
  ? (MapSettingsDefinition & {valueDefinition: Omit<DefinitionForType<U>, 'default'>})
  : T extends miscUtils.ToMapValue<infer U>
    ? (ShapeSettingsDefinition & {properties: ConfigurationDefinitionMap<U>})
    : SimpleDefinitionForType<T>;

type DefinitionForType<T> = T extends Array<infer U>
  ? (DefinitionForTypeHelper<U> & {isArray: true})
  : (DefinitionForTypeHelper<T> & {isArray?: false});

// We use this type to enforce that the types defined in the
// `ConfigurationValueMap` interface match what's listed in
// the `configuration` field from plugin definitions
//
// Note: it doesn't currently support checking enumerated types
// against what's actually put in the `values` field.
export type ConfigurationDefinitionMap<V = ConfigurationValueMap> = {
  [K in keyof V]: DefinitionForType<V[K]>;
};

function parseValue(configuration: Configuration, path: string, value: unknown, definition: SettingsDefinition, folder: PortablePath) {
  if (definition.isArray || (definition.type === SettingsType.ANY && Array.isArray(value))) {
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
    if (definition.type === SettingsType.BOOLEAN && typeof value !== `string`)
      return miscUtils.parseBoolean(value);

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
      case SettingsType.BOOLEAN:
        return miscUtils.parseBoolean(valueWithReplacedVariables);
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

  const result: Map<string, any> = getDefaultValue(configuration, definition, {
    ignoreArrays: true,
  });

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
    const normalizedKey = definition.normalizeKeys ? definition.normalizeKeys(propKey) : propKey;
    const subPath = `${path}['${normalizedKey}']`;

    // @ts-expect-error: SettingsDefinitionNoDefault has ... no default ... but
    // that's fine because we're guaranteed it's not undefined.
    const valueDefinition: SettingsDefinition = definition.valueDefinition;

    result.set(normalizedKey, parseValue(configuration, subPath, propValue, valueDefinition, folder));
  }

  return result;
}

function getDefaultValue(configuration: Configuration, definition: SettingsDefinition, {ignoreArrays = false}: {ignoreArrays?: boolean} = {}) {
  switch (definition.type) {
    case SettingsType.SHAPE: {
      if (definition.isArray && !ignoreArrays)
        return [];

      const result = new Map<string, any>();

      for (const [propKey, propDefinition] of Object.entries(definition.properties))
        result.set(propKey, getDefaultValue(configuration, propDefinition));

      return result;
    } break;

    case SettingsType.MAP: {
      if (definition.isArray && !ignoreArrays)
        return [];

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
  public static telemetry: TelemetryManager | null = null;

  public startingCwd: PortablePath;
  public projectCwd: PortablePath | null = null;

  public plugins: Map<string, Plugin> = new Map();

  public settings: Map<string, SettingsDefinition> = new Map();
  public values: Map<string, any> = new Map();
  public sources: Map<string, string> = new Map();

  public invalid: Map<string, string> = new Map();

  public packageExtensions: Map<IdentHash, Array<[string, Array<PackageExtension>]>> = new Map();

  public limits: Map<string, Limit> = new Map();

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

    const rcFiles: Array<{
      path: PortablePath;
      cwd: PortablePath;
      data: any;
      strict?: boolean
    }> = await Configuration.findRcFiles(startingCwd);

    const homeRcFile = await Configuration.findHomeRcFile();
    if (homeRcFile) {
      const rcFile = rcFiles.find(rcFile => rcFile.path === homeRcFile.path);
      // The home configuration is never strict because it improves support for
      // multiple projects using different Yarn versions on the same machine
      if (rcFile) {
        rcFile.strict = false;
      } else {
        rcFiles.push({...homeRcFile, strict: false});
      }
    }

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

    if (usePath) {
      const yarnPath = configuration.get(`yarnPath`);
      const ignorePath = configuration.get(`ignorePath`);

      if (yarnPath !== null && !ignorePath) {
        return configuration;
      }
    }

    // We need to know the project root before being able to truly instantiate
    // our configuration, and to know that we need to know the lockfile name

    const lockfileFilename = configuration.get(`lockfileFilename`);

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

    const getDefault = (object: any) => {
      return `default` in object ? object.default : object;
    };

    if (pluginConfiguration !== null) {
      for (const request of pluginConfiguration.plugins.keys())
        plugins.set(request, getDefault(pluginConfiguration.modules.get(request)));

      const requireEntries = new Map();
      for (const request of nodeUtils.builtinModules())
        requireEntries.set(request, () => miscUtils.dynamicRequire(request));
      for (const [request, embedModule] of pluginConfiguration.modules)
        requireEntries.set(request, () => embedModule);

      const dynamicPlugins = new Set();

      const importPlugin = async (pluginPath: PortablePath, source: string) => {
        const {factory, name} = miscUtils.dynamicRequire(pluginPath);

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

        const plugin = await miscUtils.prettifyAsyncErrors(async () => {
          return getDefault(await factory(pluginRequire));
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
          await importPlugin(pluginPath, `<environment>`);
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
          await importPlugin(pluginPath, path);
        }
      }
    }

    for (const [name, plugin] of plugins)
      configuration.activatePlugin(name, plugin);

    configuration.useWithSource(`<environment>`, excludeCoreFields(environmentSettings), startingCwd, {strict});
    for (const {path, cwd, data, strict: isStrict} of rcFiles)
      configuration.useWithSource(path, excludeCoreFields(data), cwd, {strict: isStrict ?? strict});

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

      if (xfs.existsSync(ppath.join(currentCwd, `package.json` as Filename)))
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

  static async updateConfiguration(cwd: PortablePath, patch: {[key: string]: ((current: unknown) => unknown) | {} | undefined} | ((current: {[key: string]: unknown}) => {[key: string]: unknown})) {
    const rcFilename = getRcFilename();
    const configurationPath =  ppath.join(cwd, rcFilename as PortablePath);

    const current = xfs.existsSync(configurationPath)
      ? parseSyml(await xfs.readFilePromise(configurationPath, `utf8`)) as any
      : {};

    let patched = false;
    let replacement: {[key: string]: unknown};

    if (typeof patch === `function`) {
      try {
        replacement = patch(current);
      } catch {
        replacement = patch({});
      }

      if (replacement === current) {
        return;
      }
    } else {
      replacement = current;

      for (const key of Object.keys(patch)) {
        const currentValue = current[key];
        const patchField = patch[key];

        let nextValue: unknown;
        if (typeof patchField === `function`) {
          try {
            nextValue = patchField(currentValue);
          } catch {
            nextValue = patchField(undefined);
          }
        } else {
          nextValue = patchField;
        }

        if (currentValue === nextValue)
          continue;

        replacement[key] = nextValue;
        patched = true;
      }

      if (!patched) {
        return;
      }
    }

    await xfs.changeFilePromise(configurationPath, stringifySyml(replacement), {
      automaticNewlines: true,
    });
  }

  static async updateHomeConfiguration(patch: {[key: string]: ((current: unknown) => unknown) | {} | undefined} | ((current: {[key: string]: unknown}) => {[key: string]: unknown})) {
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

  private importSettings(definitions: {[name: string]: SettingsDefinition | undefined}) {
    for (const [name, definition] of Object.entries(definitions)) {
      if (definition == null)
        continue;
      if (this.settings.has(name))
        throw new Error(`Cannot redefine settings "${name}"`);

      this.settings.set(name, definition);
      this.values.set(name, getDefaultValue(this, definition));
    }
  }

  useWithSource(source: string, data: {[key: string]: unknown}, folder: PortablePath, opts?: {strict?: boolean, overwrite?: boolean}) {
    try {
      this.use(source, data, folder, opts);
    } catch (error) {
      error.message += ` (in ${formatUtils.pretty(this, source, formatUtils.Type.PATH)})`;
      throw error;
    }
  }

  use(source: string, data: {[key: string]: unknown}, folder: PortablePath, {strict = true, overwrite = false}: {strict?: boolean, overwrite?: boolean} = {}) {
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

      if (this.sources.has(key) && !(overwrite || definition.type === SettingsType.MAP || definition.isArray && definition.concatenateValues))
        continue;

      let parsed;
      try {
        parsed = parseValue(this, key, data[key], definition, folder);
      } catch (error) {
        error.message += ` in ${formatUtils.pretty(this, source, formatUtils.Type.PATH)}`;
        throw error;
      }

      if (definition.type === SettingsType.MAP) {
        const previousValue = this.values.get(key) as Map<string, any>;
        this.values.set(key, new Map(overwrite
          ? [...previousValue, ...parsed as Map<string, any>]
          : [...parsed as Map<string, any>, ...previousValue]
        ));
        this.sources.set(key, `${this.sources.get(key)}, ${source}`);
      } else if (definition.isArray && definition.concatenateValues) {
        const previousValue = this.values.get(key) as Array<unknown>;
        this.values.set(key, overwrite
          ? [...previousValue, ...parsed as Array<unknown>]
          : [...parsed as Array<unknown>, ...previousValue]
        );
        this.sources.set(key, `${this.sources.get(key)}, ${source}`);
      } else {
        this.values.set(key, parsed);
        this.sources.set(key, source);
      }
    }
  }

  get<K extends keyof ConfigurationValueMap>(key: K): ConfigurationValueMap[K];
  get(key: string): unknown;
  get(key: string) {
    if (!this.values.has(key))
      throw new Error(`Invalid configuration key "${key}"`);

    return this.values.get(key);
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
      const stdoutLineReporter = report.createStreamReporter(`${prefix} ${formatUtils.pretty(this, `STDOUT`, `green`)}`);
      const stderrLineReporter = report.createStreamReporter(`${prefix} ${formatUtils.pretty(this, `STDERR`, `red`)}`);

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

    const registerPackageExtension = (descriptor: Descriptor, extensionData: PackageExtensionData, {userProvided = false}: {userProvided?: boolean} = {}) => {
      if (!semverUtils.validRange(descriptor.range))
        throw new Error(`Only semver ranges are allowed as keys for the lockfileExtensions setting`);

      const extension = new Manifest();
      extension.load(extensionData, {yamlCompatibilityMode: true});

      const extensionsPerIdent = miscUtils.getArrayWithDefault(packageExtensions, descriptor.identHash);

      const extensionsPerRange: Array<PackageExtension> = [];
      extensionsPerIdent.push([descriptor.range, extensionsPerRange]);

      const baseExtension = {
        status: PackageExtensionStatus.Inactive,
        userProvided,
        parentDescriptor: descriptor,
      } as const;

      for (const dependency of extension.dependencies.values())
        extensionsPerRange.push({...baseExtension, type: PackageExtensionType.Dependency, descriptor: dependency});
      for (const peerDependency of extension.peerDependencies.values())
        extensionsPerRange.push({...baseExtension, type: PackageExtensionType.PeerDependency, descriptor: peerDependency});

      for (const [selector, meta] of extension.peerDependenciesMeta) {
        for (const [key, value] of Object.entries(meta)) {
          extensionsPerRange.push({...baseExtension, type: PackageExtensionType.PeerDependencyMeta, selector, key: key as keyof typeof meta, value});
        }
      }
    };

    await this.triggerHook(hooks => {
      return hooks.registerPackageExtensions;
    }, this, registerPackageExtension);

    for (const [descriptorString, extensionData] of this.get(`packageExtensions`)) {
      registerPackageExtension(structUtils.parseDescriptor(descriptorString, true), miscUtils.convertMapsToIndexableObjects(extensionData), {userProvided: true});
    }
  }

  normalizePackage(original: Package) {
    const pkg = structUtils.copyPackage(original);

    // We use the extensions to define additional dependencies that weren't
    // properly listed in the original package definition

    if (this.packageExtensions == null)
      throw new Error(`refreshPackageExtensions has to be called before normalizing packages`);

    const extensionsPerIdent = this.packageExtensions.get(original.identHash);
    if (typeof extensionsPerIdent !== `undefined`) {
      const version = original.version;

      if (version !== null) {
        for (const [range, extensionsPerRange] of extensionsPerIdent) {
          if (!semverUtils.satisfiesWithPrereleases(version, range))
            continue;

          for (const extension of extensionsPerRange) {
            // If an extension is active for a package but redundant
            // for another one, it should be considered active
            if (extension.status === PackageExtensionStatus.Inactive)
              extension.status = PackageExtensionStatus.Redundant;

            switch (extension.type) {
              case PackageExtensionType.Dependency: {
                const currentDependency = pkg.dependencies.get(extension.descriptor.identHash);
                if (typeof currentDependency === `undefined`) {
                  extension.status = PackageExtensionStatus.Active;
                  pkg.dependencies.set(extension.descriptor.identHash, extension.descriptor);
                }
              } break;

              case PackageExtensionType.PeerDependency: {
                const currentPeerDependency = pkg.peerDependencies.get(extension.descriptor.identHash);
                if (typeof currentPeerDependency === `undefined`) {
                  extension.status = PackageExtensionStatus.Active;
                  pkg.peerDependencies.set(extension.descriptor.identHash, extension.descriptor);
                }
              } break;

              case PackageExtensionType.PeerDependencyMeta: {
                const currentPeerDependencyMeta = pkg.peerDependenciesMeta.get(extension.selector);
                if (typeof currentPeerDependencyMeta === `undefined` || !Object.prototype.hasOwnProperty.call(currentPeerDependencyMeta, extension.key) || currentPeerDependencyMeta[extension.key] !== extension.value) {
                  extension.status = PackageExtensionStatus.Active;
                  miscUtils.getFactoryWithDefault(pkg.peerDependenciesMeta, extension.selector, () => ({} as PeerDependencyMeta))[extension.key] = extension.value;
                }
              } break;

              default: {
                miscUtils.assertNever(extension);
              } break;
            }
          }
        }
      }
    }

    // We also add implicit optional @types peer dependencies for each peer
    // dependency. This is for compatibility reason, as many existing packages
    // forget to define their @types/react optional peer dependency when they
    // peer-depend on react.

    const getTypesName = (descriptor: Descriptor) => {
      return descriptor.scope
        ? `${descriptor.scope}__${descriptor.name}`
        : `${descriptor.name}`;
    };

    for (const descriptor of pkg.peerDependencies.values()) {
      if (descriptor.scope === `types`)
        continue;

      const typesName = getTypesName(descriptor);
      const typesIdent = structUtils.makeIdent(`types`, typesName);
      const stringifiedTypesIdent = structUtils.stringifyIdent(typesIdent);

      if (pkg.peerDependencies.has(typesIdent.identHash) || pkg.peerDependenciesMeta.has(stringifiedTypesIdent))
        continue;

      pkg.peerDependenciesMeta.set(stringifiedTypesIdent, {
        optional: true,
      });
    }

    // I don't like implicit dependencies, but package authors are reluctant to
    // use optional peer dependencies because they would print warnings in older
    // npm releases.

    for (const identString of pkg.peerDependenciesMeta.keys()) {
      const ident = structUtils.parseIdent(identString);

      if (!pkg.peerDependencies.has(ident.identHash)) {
        pkg.peerDependencies.set(ident.identHash, structUtils.makeDescriptor(ident, `*`));
      }
    }

    // We sort the dependencies so that further iterations always occur in the
    // same order, regardless how the various registries formatted their output

    pkg.dependencies = new Map(miscUtils.sortMap(pkg.dependencies, ([, descriptor]) => structUtils.stringifyDescriptor(descriptor)));
    pkg.peerDependencies = new Map(miscUtils.sortMap(pkg.peerDependencies, ([, descriptor]) => structUtils.stringifyDescriptor(descriptor)));

    return pkg;
  }

  getLimit<K extends miscUtils.FilterKeys<ConfigurationValueMap, number>>(key: K) {
    return miscUtils.getFactoryWithDefault(this.limits, key, () => {
      return pLimit(this.get(key));
    });
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
        // @ts-expect-error
        return ret;
      }
    }

    return null;
  }
}
