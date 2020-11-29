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
  /**
   * Hook to be able to exclude patterns from being picked up by this plugin.
   *
   * @param addGitHostedRepository call this function to add a pattern to be excluded
   */
  addHandledHostedRepository?: (addHandledHostedRepository: (regExp: RegExp) => void) => Promise<void>,
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
