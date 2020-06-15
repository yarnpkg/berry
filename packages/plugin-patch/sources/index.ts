import {Plugin, Project} from '@yarnpkg/core';

import {PatchFetcher}    from './PatchFetcher';
import {PatchResolver}   from './PatchResolver';
import PatchCommit       from './commands/patchCommit';
import Patch             from './commands/patch';
import * as patchUtils   from './patchUtils';

export {patchUtils};

export interface Hooks {
  getBuiltinPatch?: (
    project: Project,
    name: string,
  ) => Promise<string | null | void>,
}

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
