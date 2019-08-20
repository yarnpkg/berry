import {Plugin}      from '@berry/core';

import {GitFetcher}  from './GitFetcher';
import {GitResolver} from './GitResolver';

const plugin: Plugin = {
  fetchers: [
    GitFetcher,
  ],
  resolvers: [
    GitResolver,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
