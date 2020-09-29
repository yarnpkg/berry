import {Plugin}        from '@yarnpkg/core';

import {GithubFetcher} from './GithubFetcher';

const plugin: Plugin = {
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
};

// eslint-disable-next-line arca/no-default-export
export default plugin as Plugin;
