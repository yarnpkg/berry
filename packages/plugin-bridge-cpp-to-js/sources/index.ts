import {Plugin}                from '@yarnpkg/core';

import {CppToJsBridgeFetcher}  from './CppToJsBridgeFetcher';
import {CppToJsBridgeResolver} from './CppToJsBridgeResolver';

const plugin: Plugin = {
  fetchers: [
    CppToJsBridgeFetcher,
  ],
  resolvers: [
    CppToJsBridgeResolver,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
