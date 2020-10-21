import {Plugin}                     from '@yarnpkg/core';
import {Hooks as GitHooks}          from '@yarnpkg/plugin-git';

import {GithubFetcher}              from './GithubFetcher';
import {GithubResolver}             from './GithubResolver';
import {addHandledHostedRepository} from "./githubUtils";

const plugin: Plugin<GitHooks> = {
  hooks: {
    /**
     * @deprecated
     */
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
    addHandledHostedRepository,
  },
  fetchers: [
    GithubFetcher,
  ],
  resolvers: [
    GithubResolver,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin as Plugin;
