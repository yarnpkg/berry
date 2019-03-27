import {SettingsDefinition, PluginConfiguration} from './Configuration';
import {Fetcher}                                 from './Fetcher';
import {Linker}                                  from './Linker';
import {Project}                                 from './Project';
import {Resolver}                                from './Resolver';

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
    env: {[key: string]: string},
    makePathWrapper: (name: string, argv0: string, args: Array<string>) => Promise<void>,
  ) => Promise<void>,

  // Called after the `install` method from the `Project` class successfully
  // completed.
  afterAllInstalled?: (
    project: Project,
  ) => void,
};

export type Plugin = {
  configuration?: {[key: string]: SettingsDefinition},
  commands?: Array<(concierge: any, pluginConfiguration: PluginConfiguration) => any>,
  fetchers?: Array<FetcherPlugin>,
  linkers?: Array<LinkerPlugin>,
  resolvers?: Array<ResolverPlugin>,
  hooks?: {[key: string]: any},
};
