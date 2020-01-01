import {PortablePath}                            from '@yarnpkg/fslib';
import {CommandClass}                            from 'clipanion';
import {Writable, Readable}                      from 'stream';

import {SettingsDefinition, PluginConfiguration} from './Configuration';
import {Fetcher}                                 from './Fetcher';
import {Linker}                                  from './Linker';
import {Project}                                 from './Project';
import {Resolver}                                from './Resolver';
import {Locator, Descriptor}                     from './types';

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
};

export interface LinkerPlugin {
  new(): Linker;
};

export interface ResolverPlugin {
  new(): Resolver;
};

export type Hooks = {
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

  // Before the resolution runs; should be use to setup new aliases that won't
  // persist on the project instance itself.
  reduceDependency?: (
    dependency: Descriptor,
    project: Project,
    locator: Locator,
    initialDependency: Descriptor,
  ) => Promise<Descriptor>,

  // Called after the `install` method from the `Project` class successfully
  // completed.
  afterAllInstalled?: (
    project: Project,
  ) => void,
};

export type Plugin<PluginHooks = any> = {
  configuration?: {[key: string]: SettingsDefinition},
  commands?: Array<CommandClass<CommandContext>>,
  fetchers?: Array<FetcherPlugin>,
  linkers?: Array<LinkerPlugin>,
  resolvers?: Array<ResolverPlugin>,
  hooks?: PluginHooks,
};
