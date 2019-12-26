import {Plugin}        from '@yarnpkg/core';

import PatchCommit     from './commands/patchCommit';
import Patch           from './commands/patch';
import {PatchFetcher}  from './PatchFetcher';
import {PatchResolver} from './PatchResolver';

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
