import {Plugin}               from '@yarnpkg/core';

import {ExecFetcher, ExecEnv} from './ExecFetcher';
import {ExecResolver}         from './ExecResolver';
import * as execUtils         from './execUtils';

export type {ExecEnv};
export {execUtils};

const plugin: Plugin = {
  fetchers: [
    ExecFetcher,
  ],
  resolvers: [
    ExecResolver,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
