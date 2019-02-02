import {SettingsDefinition} from './Configuration';
import {Fetcher}            from './Fetcher';
import {Linker}             from './Linker';
import {Project}            from './Project';
import {Resolver}           from './Resolver';

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
export interface BerryHooks {
  afterAllInstalled?: (project: Project) => void,
};

export type Plugin = {
  configuration?: {[key: string]: SettingsDefinition},
  commands?: Array<(concierge: any, plugins: Map<string, Plugin>) => any>,
  fetchers?: Array<FetcherPlugin>,
  linkers?: Array<LinkerPlugin>,
  resolvers?: Array<ResolverPlugin>,
  hooks?: BerryHooks,
};
