import {Plugin}              from '@yarnpkg/core';

import {TarballHttpFetcher}  from './TarballHttpFetcher';
import {TarballHttpResolver} from './TarballHttpResolver';

const plugin: Plugin = {
  fetchers: [
    TarballHttpFetcher,
  ],
  resolvers: [
    TarballHttpResolver,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
