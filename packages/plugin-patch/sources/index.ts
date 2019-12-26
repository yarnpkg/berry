import {Plugin}        from '@yarnpkg/core';

import {PatchFetcher}  from './PatchFetcher';
import {PatchResolver} from './PatchResolver';
import PatchCommit     from './commands/patchCommit';
import Patch           from './commands/patch';

const plugin: Plugin = {
  commands: [
    PatchCommit,
    Patch,
  ],
  fetchers: [
    PatchFetcher,
  ],
  resolvers: [
    PatchResolver,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
