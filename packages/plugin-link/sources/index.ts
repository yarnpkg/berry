import {Plugin}          from '@berry/core';

import {RawLinkFetcher}  from './RawLinkFetcher';
import {RawLinkResolver} from './RawLinkResolver';
import {LinkFetcher}     from './LinkFetcher';
import {LinkResolver}    from './LinkResolver';

const plugin: Plugin = {
  fetchers: [
    new RawLinkFetcher(),
    new LinkFetcher(),
  ],
  linkers: [
    //new RawLinkLinker(),
    //new LinkLinker(),
  ],
  resolvers: [
    new RawLinkResolver(),
    new LinkResolver(),
  ],
};

export default plugin;
