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
    changesetBaseRefs: Array<string>;
    changesetIgnorePatterns: Array<string>;
    cloneConcurrency: number;
  }
}

const plugin: Plugin = {
  configuration: {
    changesetBaseRefs: {
      description: `The base git refs that the current HEAD is compared against when detecting changes. Supports git branches, tags, and commits.`,
      type: SettingsType.STRING,
      isArray: true,
      isNullable: false,
      default: [`master`, `origin/master`, `upstream/master`, `main`, `origin/main`, `upstream/main`],
    },
    changesetIgnorePatterns: {
      description: `Array of glob patterns; files matching them will be ignored when fetching the changed files`,
      type: SettingsType.STRING,
      default: [],
      isArray: true,
    },
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
