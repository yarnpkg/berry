import {Plugin}         from '@yarnpkg/core';

import {LinkFetcher}    from './LinkFetcher';
import {LinkResolver}   from './LinkResolver';
import {PortalFetcher}  from './PortalFetcher';
import {PortalResolver} from './PortalResolver';

export {PortalFetcher};
export {PortalResolver};
export {LinkFetcher};
export {LinkResolver};

const plugin: Plugin = {
  fetchers: [
    LinkFetcher,
    PortalFetcher,
  ],
  resolvers: [
    LinkResolver,
    PortalResolver,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
