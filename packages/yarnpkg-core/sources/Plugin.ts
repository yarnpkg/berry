import {PortablePath}                                           from '@yarnpkg/fslib';
import {CommandClass}                                           from 'clipanion';
import {Writable, Readable}                                     from 'stream';

import {SettingsDefinition, PluginConfiguration, Configuration} from './Configuration';
import {Fetcher}                                                from './Fetcher';
import {Linker}                                                 from './Linker';
import {MessageName}                                            from './MessageName';
import {Project}                                                from './Project';
import {Resolver, ResolveOptions}                               from './Resolver';
import {Workspace}                                              from './Workspace';
import {Locator, Descriptor}                                    from './types';

type ProcessEnvironment = {[key: string]: string};

export type CommandContext = {
  cwd: PortablePath;
  plugins: PluginConfiguration;
  quiet: boolean;
  stdin: Readable;
  stdout: Writable;
  stderr: Writable;
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

export type Hooks = {
  // Called when the package extensions are setup. Can be used to inject new
  // ones (for example, that's what the compat plugin uses to workaround
  // metadata problems).
  registerPackageExtensions?: (
    configuration: Configuration,
    registerPackageExtension: (descriptor: Descriptor, extensionData: any) => void,
  ) => Promise<void>;

  // Called before a script is executed. The hooks are allowed to modify the
  // `env` object as they see fit, and any call to `makePathWrapper` will cause
  // a binary of the given name to be injected somewhere within the PATH (we
  // recommend you don't alter the PATH yourself unless required).
  //
  // The keys you get in the env are guaranteed to be uppercase. We strongly
  // suggest you adopt this convention for any new key added to the env (we
  // might enforce it later on).
  setupScriptEnvironment?: (
    project: Project,
    env: ProcessEnvironment,
    makePathWrapper: (name: string, argv0: string, args: Array<string>) => Promise<void>,
  ) => Promise<void>,

  // When a script is getting executed. You must call the executor, or the
  // script won't be called at all.
  wrapScriptExecution?: (
    executor: () => Promise<number>,
    project: Project,
    locator: Locator,
    scriptName: string,
    extra: {script: string, args: Array<string>, cwd: PortablePath, env: ProcessEnvironment, stdin: Readable | null, stdout: Writable, stderr: Writable},
  ) => Promise<() => Promise<number>>,

  // Called before the build, to compute a global hash key that we will use
  // to detect whether packages must be rebuilt (typically when the Node
  // version changes)
  globalHashGeneration?: (
    project: Project,
    contributeHash: (data: string | Buffer) => void,
  ) => Promise<void>,

  // Before the resolution runs; should be use to setup new aliases that won't
  // persist on the project instance itself.
  reduceDependency?: (
    dependency: Descriptor,
    project: Project,
    locator: Locator,
    initialDependency: Descriptor,
    extra: {resolver: Resolver, resolveOptions: ResolveOptions},
  ) => Promise<Descriptor>,

  // Called after the `install` method from the `Project` class successfully
  // completed.
  afterAllInstalled?: (
    project: Project,
  ) => void,

  // Called during the `Validation step` of the `install` method from the `Project`
  // class.
  validateProject?: (
    project: Project,
    report: {
      reportWarning: (name: MessageName, text: string) => void,
      reportError: (name: MessageName, text: string) => void,
    }
  ) => void;

  // Called during the `Validation step` of the `install` method from the `Project`
  // class by the `validateProject` hook.
  validateWorkspace?: (
    workspace: Workspace,
    report: {
      reportWarning: (name: MessageName, text: string) => void,
      reportError: (name: MessageName, text: string) => void,
    }
  ) => void;
};

export type Plugin<PluginHooks = any> = {
  configuration?: {[key: string]: SettingsDefinition},
  commands?: Array<CommandClass<CommandContext>>,
  fetchers?: Array<FetcherPlugin>,
  linkers?: Array<LinkerPlugin>,
  resolvers?: Array<ResolverPlugin>,
  hooks?: PluginHooks,
};
