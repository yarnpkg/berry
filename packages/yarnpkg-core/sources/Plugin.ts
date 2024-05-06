import {PortablePath}                                                                         from '@yarnpkg/fslib';
import {CommandClass}                                                                         from 'clipanion';
import {Writable, Readable}                                                                   from 'stream';

import {PluginConfiguration, Configuration, ConfigurationDefinitionMap, PackageExtensionData} from './Configuration';
import {Fetcher}                                                                              from './Fetcher';
import {Linker}                                                                               from './Linker';
import {MessageName}                                                                          from './MessageName';
import {Project, InstallOptions}                                                              from './Project';
import {Resolver, ResolveOptions}                                                             from './Resolver';
import {Workspace}                                                                            from './Workspace';
import * as httpUtils                                                                         from './httpUtils';
import {Locator, Descriptor}                                                                  from './types';

export type CommandContext = {
  cwd: PortablePath;
  env: Record<string, string | undefined>;
  plugins: PluginConfiguration;
  quiet: boolean;
  stdin: Readable;
  stdout: Writable;
  stderr: Writable;
  colorDepth: number;
};

export interface FetcherPlugin {
  new(): Fetcher;
}

export interface LinkerPlugin {
  new(): Linker;
}

export interface ResolverPlugin {
  new(): Resolver;
}

export type WrapNetworkRequestInfo = httpUtils.Options & {
  target: string | URL;
  body: httpUtils.Body;
};

export interface Hooks {
  /**
   * Called when the package extensions are setup. Can be used to inject new
   * ones. That's for example what the compat plugin uses to automatically fix
   * packages with known flaws.
   */
  registerPackageExtensions?: (
    configuration: Configuration,
    registerPackageExtension: (descriptor: Descriptor, extensionData: PackageExtensionData) => void,
  ) => Promise<void>;

  /**
   * Called before a script is executed. The hooks are allowed to modify the
   * `env` object as they see fit, and any call to `makePathWrapper` will cause
   * a binary of the given name to be injected somewhere within the PATH (we
   * recommend you don't alter the PATH yourself unless required).
   *
   * The keys you get in the env are guaranteed to be uppercase. We strongly
   * suggest you adopt this convention for any new key added to the env (we
   * might enforce it later on).
   */
  setupScriptEnvironment?: (
    project: Project,
    env: NodeJS.ProcessEnv,
    makePathWrapper: (name: string, argv0: string, args: Array<string>) => Promise<void>,
  ) => Promise<void>;

  /**
   * Called as a script is getting executed. The `executor` function parameter,
   * when called, will execute the script. You can use this mechanism to wrap
   * script executions, for example to run some validation or add some
   * performance monitoring.
   */
  wrapScriptExecution?: (
    executor: () => Promise<number>,
    project: Project,
    locator: Locator,
    scriptName: string,
    extra: {script: string, args: Array<string>, cwd: PortablePath, env: NodeJS.ProcessEnv, stdin: Readable | null, stdout: Writable, stderr: Writable},
  ) => Promise<() => Promise<number>>;

  /**
   * Called when a network request is being made. The `executor` function
   * parameter, when called, will trigger the network request. You can use this
   * mechanism to wrap network requests, for example to run some validation or
   * add some logging.
   */
  wrapNetworkRequest?: (
    executor: () => Promise<httpUtils.Response>,
    extra: WrapNetworkRequestInfo
  ) => Promise<() => Promise<httpUtils.Response>>;

  /**
   * Called before the build, to compute a global hash key that we will use
   * to detect whether packages must be rebuilt (typically when the Node
   * version changes).
   */
  globalHashGeneration?: (
    project: Project,
    contributeHash: (data: string | Buffer) => void,
  ) => Promise<void>;

  /**
   * Called during the resolution, once for each resolved package and each of
   * their dependencies. By returning a new dependency descriptor you can
   * replace the original one by a different range.
   *
   * Note that when multiple plugins are registered on `reduceDependency` they
   * will be executed in definition order. In that case, `dependency` will
   * always refer to the dependency as it currently is, whereas
   * `initialDependency` will be the descriptor before any plugin attempted to
   * change it.
   */
  reduceDependency?: (
    dependency: Descriptor,
    project: Project,
    locator: Locator,
    initialDependency: Descriptor,
    extra: {resolver: Resolver, resolveOptions: ResolveOptions},
  ) => Promise<Descriptor>;

  /**
   * Called after the `install` method from the `Project` class successfully
   * completed.
   */
  afterAllInstalled?: (
    project: Project,
    options: InstallOptions
  ) => void;

  /**
   * Called during the `Validation step` of the `install` method from the
   * `Project` class.
   */
  validateProject?: (
    project: Project,
    report: {
      reportWarning: (name: MessageName, text: string) => void;
      reportError: (name: MessageName, text: string) => void;
    }
  ) => void;

  /**
   * Called during the `Post-install validation step` of the `install` method
   * from the `Project` class.
   */
  validateProjectAfterInstall?: (
    project: Project,
    report: {
      reportWarning: (name: MessageName, text: string) => void;
      reportError: (name: MessageName, text: string) => void;
    }
  ) => void;

  /**
   * Called during the `Validation step` of the `install` method from the
   * `Project` class by the `validateProject` hook.
   */
  validateWorkspace?: (
    workspace: Workspace,
    report: {
      reportWarning: (name: MessageName, text: string) => void;
      reportError: (name: MessageName, text: string) => void;
    }
  ) => void;

  /**
   * Used to notify the core of all the potential artifacts of the available
   * linkers.
   */
  populateYarnPaths?: (
    project: Project,
    definePath: (path: PortablePath | null) => void,
  ) => Promise<void>;

  /**
   * Called when the user requests to clean the global cache. Plugins should
   * use this hook to remove their own global artifacts.
   */
  cleanGlobalArtifacts?: (
    configuration: Configuration,
  ) => Promise<void>;
}

export type Plugin<PluginHooks = any> = {
  configuration?: Partial<ConfigurationDefinitionMap>;
  commands?: Array<CommandClass<CommandContext>>;
  fetchers?: Array<FetcherPlugin>;
  linkers?: Array<LinkerPlugin>;
  resolvers?: Array<ResolverPlugin>;
  hooks?: PluginHooks;
};

// for RC file
export interface PluginMeta {
  path: PortablePath;
  spec: string;
  checksum?: string;
}
