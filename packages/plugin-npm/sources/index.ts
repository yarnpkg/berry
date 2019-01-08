import {Plugin}            from '@berry/core';

import {NpmFetcher}        from './NpmFetcher';
import {NpmSemverResolver} from './NpmSemverResolver';
import {NpmTagResolver}    from './NpmTagResolver';

const plugin: Plugin = {
  fetchers: [
    NpmFetcher,
  ],
  resolvers: [
    NpmSemverResolver,
    NpmTagResolver,
  ],
};

export default plugin;
