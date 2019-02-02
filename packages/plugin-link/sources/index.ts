import {Plugin}          from '@berry/core';

import {RawLinkFetcher}  from './RawLinkFetcher';
import {RawLinkResolver} from './RawLinkResolver';
import {LinkFetcher}     from './LinkFetcher';
import {LinkResolver}    from './LinkResolver';

const plugin: Plugin = {
  fetchers: [
    RawLinkFetcher,
    LinkFetcher,
  ],
  resolvers: [
    RawLinkResolver,
    LinkResolver,
  ],
};

export default plugin;
