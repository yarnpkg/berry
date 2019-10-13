import {Plugin}        from '@yarnpkg/core';

import {GithubFetcher} from './GithubFetcher';

const plugin: Plugin = {
  fetchers: [
    GithubFetcher,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
