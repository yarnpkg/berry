import {Plugin}                    from '@yarnpkg/core';

import {CMakeToNodeBridgeFetcher}  from './CMakeToNodeBridgeFetcher';
import {CMakeToNodeBridgeResolver} from './CMakeToNodeBridgeResolver';

const plugin: Plugin = {
  fetchers: [
    CMakeToNodeBridgeFetcher,
  ],
  resolvers: [
    CMakeToNodeBridgeResolver,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
