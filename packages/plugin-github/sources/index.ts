import {Plugin}            from '@yarnpkg/core';
import {Hooks as GitHooks} from '@yarnpkg/plugin-git';

import {GithubFetcher}     from './GithubFetcher';

const plugin: Plugin<GitHooks> = {
  hooks: {
    async fetchHostedRepository({ previous, locator, options }) {
      if (previous !== null)
        return previous;

      const fetcher = new GithubFetcher();
      if (!fetcher.supports(locator, options))
        return null;

      try {
        return await fetcher.fetch(locator, options);
      } catch (error) {
        return null;
      }
    },
  },
};

// eslint-disable-next-line arca/no-default-export
export default plugin as Plugin;
