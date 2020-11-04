import {FetchOptions, FetchResult, Locator, Plugin, SettingsType} from '@yarnpkg/core';

import {GitFetcher}                                               from './GitFetcher';
import {GitResolver}                                              from './GitResolver';
import * as gitUtils                                              from './gitUtils';

export interface Hooks {
  fetchHostedRepository?: (
    current: FetchResult | null,
    locator: Locator,
    opts: FetchOptions,
  ) => Promise<FetchResult | null>,
}

declare module '@yarnpkg/core' {
  interface ConfigurationValueMap {
    cloneConcurrency: number;
  }
}

const plugin: Plugin = {
  configuration: {
    cloneConcurrency: {
      description: `Maximal number of concurrent clones`,
      type: SettingsType.NUMBER,
      default: 2,
    },
  },
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
