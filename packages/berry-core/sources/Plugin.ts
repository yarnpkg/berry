import {Fetcher}  from './Fetcher';
import {Resolver} from './Resolver';

export type Plugin = {
  fetchers?: Array<Fetcher>,
  resolvers?: Array<Resolver>,
  commands?: Array<(concierge: any, plugins: Map<string, Plugin>) => any>,
};
