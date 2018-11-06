import {Plugin}            from '@berry/core';

import {NpmFetcher}        from './NpmFetcher';
import {NpmSemverResolver} from './NpmSemverResolver';
import {NpmTagResolver}    from './NpmTagResolver';

const plugin: Plugin = {
  fetchers: [
    new NpmFetcher(),
  ],
  resolvers: [
    new NpmSemverResolver(),
    new NpmTagResolver(),
  ],
};

export default plugin;
