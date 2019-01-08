import {Plugin}              from '@berry/core';

import {TarballHttpResolver} from './TarballHttpResolver';
import {TarballHttpFetcher}  from './TarballHttpFetcher';

const plugin: Plugin = {
  fetchers: [
    TarballHttpFetcher,
  ],
  resolvers: [
    TarballHttpResolver,
  ],
};

export default plugin;
