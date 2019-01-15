import {Fetcher}  from './Fetcher';
import {Linker}   from './Linker';
import {Project}  from './Project';
import {Resolver} from './Resolver';

export interface FetcherPlugin {
  new(): Fetcher;
};

export interface LinkerPlugin {
  new(): Linker;
};

export interface ResolverPlugin {
  new(): Resolver;
};

export interface BerryHooks {
  afterAllInstalled?: (project: Project) => void,
};

export type Plugin = {
  commands?: Array<(concierge: any, plugins: Map<string, Plugin>) => any>,
  fetchers?: Array<FetcherPlugin>,
  linkers?: Array<LinkerPlugin>,
  resolvers?: Array<ResolverPlugin>,
  hooks?: BerryHooks,
};
