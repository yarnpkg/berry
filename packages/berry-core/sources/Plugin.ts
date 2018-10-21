import {Fetcher}  from './Fetcher';
import {Resolver} from './Resolver';

export type Plugin = {
  commands?: Array<(concierge: any, plugins: Map<string, Plugin>) => any>,
  fetchers?: Array<Fetcher & {mountPoint: string}>,
  linkers?: Array<any>,
  resolvers?: Array<Resolver>,
};
