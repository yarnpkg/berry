import {Plugin}              from '@berry/core';

import {TarballHttpResolver} from './TarballHttpResolver';
import {TarballHttpFetcher}  from './TarballHttpFetcher';

const plugin: Plugin = {
  fetchers: [
    new TarballHttpFetcher(),
  ],
  resolvers: [
    new TarballHttpResolver(),
  ],
};

export default plugin;
