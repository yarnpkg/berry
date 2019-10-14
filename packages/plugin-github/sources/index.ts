import {Plugin}            from '@yarnpkg/core';
import {Hooks as GitHooks} from '@yarnpkg/plugin-git';

import {GithubFetcher}     from './GithubFetcher';

const plugin: Plugin<GitHooks> = {
  hooks: {
    async fetchHostedRepository(previous, locator, opts) {
      if (previous !== null)
        return previous;

      const fetcher = new GithubFetcher();
      if (!fetcher.supports(locator, opts))
        return null;

      try {
        return await fetcher.fetch(locator, opts);
      } catch (error) {
        return null;
      }
    },
  },
  fetchers: [],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
