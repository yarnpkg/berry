import {Plugin}         from '@yarnpkg/core';

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

// eslint-disable-next-line arca/no-default-export
export default plugin;
