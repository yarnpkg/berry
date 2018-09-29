import {Plugin}      from '@berry/core';

import {NpmFetcher}  from './NpmFetcher';
import {NpmResolver} from './NpmResolver';

const plugin: Plugin = {
  fetchers: [
    new NpmFetcher(),
  ],
  resolvers: [
    new NpmResolver(),
  ],
};

export default plugin;
