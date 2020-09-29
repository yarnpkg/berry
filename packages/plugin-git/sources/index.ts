import {FetchOptions, FetchResult, Locator, Plugin, SettingsType} from '@yarnpkg/core';

import {GitFetcher}                                               from './GitFetcher';
import {GitResolver}                                              from './GitResolver';
import * as gitUtils                                              from './gitUtils';

interface GitHooks {
  fetchHostedRepository?: (
    current: FetchResult | null,
    locator: Locator,
    opts: FetchOptions,
  ) => Promise<FetchResult | null>,
}

/** @deprecated use Hooks from @yarnpkg/core instead */
export type Hooks = GitHooks;

declare module '@yarnpkg/core' {
  interface ConfigurationValueMap {
    cloneConcurrency: number;
  }

  interface Hooks extends GitHooks {
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
