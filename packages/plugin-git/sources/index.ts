import {FetchOptions, FetchResult, Locator, Plugin} from '@yarnpkg/core';

import {GitFetcher}                                 from './GitFetcher';
import {GitResolver}                                from './GitResolver';
import * as gitUtils                                from './gitUtils';

export interface Hooks {
  fetchHostedRepository?: (
    current: FetchResult | null,
    locator: Locator,
    opts: FetchOptions,
  ) => Promise<FetchResult | null>,
}

const plugin: Plugin = {
  fetchers: [
    GitFetcher,
  ],
  resolvers: [
    GitResolver,
  ],
};

export {gitUtils};

// eslint-disable-next-line arca/no-default-export
export default plugin;
