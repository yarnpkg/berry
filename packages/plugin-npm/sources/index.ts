import {Plugin}            from '@berry/core';

import {NpmFetcher}        from './NpmFetcher';
import {NpmRemapResolver}  from './NpmRemapResolver';
import {NpmSemverResolver} from './NpmSemverResolver';
import {NpmTagResolver}    from './NpmTagResolver';

const plugin: Plugin = {
  fetchers: [
    NpmFetcher,
  ],
  resolvers: [
    NpmRemapResolver,
    NpmSemverResolver,
    NpmTagResolver,
  ],
};

export default plugin;
