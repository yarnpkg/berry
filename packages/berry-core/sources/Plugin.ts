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

// We keep this one an interface because we allow other plugins to extend it
// with new hooks, cf TypeScript documentation on declaration merging
export interface Hooks {
  afterAllInstalled?: (project: Project) => void,
};

export type Plugin = {
  configuration?: {[key: string]: SettingsDefinition},
  commands?: Array<(concierge: any, pluginConfiguration: PluginConfiguration) => any>,
  fetchers?: Array<FetcherPlugin>,
  linkers?: Array<LinkerPlugin>,
  resolvers?: Array<ResolverPlugin>,
  hooks?: {[key: string]: any},
};
