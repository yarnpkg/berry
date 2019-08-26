import {Plugin}       from '@yarnpkg/core';

import {ExecFetcher}  from './ExecFetcher';
import {ExecResolver} from './ExecResolver';

const plugin: Plugin = {
  fetchers: [
    ExecFetcher,
  ],
  resolvers: [
    ExecResolver,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
