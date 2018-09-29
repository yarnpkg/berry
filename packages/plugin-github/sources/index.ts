import {Plugin}         from '@berry/core';

import {GithubFetcher}  from './GithubFetcher';
import {GithubResolver} from './GithubResolver';

const plugin: Plugin = {
  fetchers: [
    new GithubFetcher(),
  ],
  resolvers: [
    new GithubResolver(),
  ],
};

export default plugin;
