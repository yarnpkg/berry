import {Plugin}         from '@berry/core';

import {GithubFetcher}  from './GithubFetcher';
import {GithubResolver} from './GithubResolver';

const plugin: Plugin = {
  fetchers: [
    GithubFetcher,
  ],
  resolvers: [
    GithubResolver,
  ],
};

export default plugin;
