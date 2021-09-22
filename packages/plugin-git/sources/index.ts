import {FetchOptions, FetchResult, Locator, Plugin, SettingsType} from '@yarnpkg/core';

import {GitFetcher}                                               from './GitFetcher';
import {GitResolver}                                              from './GitResolver';
import * as gitUtils                                              from './gitUtils';

export interface Hooks {
  /**
   * Called when a Git repository is fetched. If the function returns `null`
   * the repository will be cloned and packed; otherwise, it must returns a
   * value compatible with what a fetcher would return.
   *
   * The main use case for this hook is to let you implement smarter cloning
   * strategies depending on the hosting platform. For instance, GitHub
   * supports downloading repository tarballs, which are more efficient than
   * cloning the repository (even without its history).
   */
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
