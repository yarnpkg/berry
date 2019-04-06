import {Plugin}          from '@berry/core';

import {LinkFetcher}     from './LinkFetcher';
import {LinkResolver}    from './LinkResolver';
import {RawLinkFetcher}  from './RawLinkFetcher';
import {RawLinkResolver} from './RawLinkResolver';

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

// eslint-disable-next-line arca/no-default-export
export default plugin;
