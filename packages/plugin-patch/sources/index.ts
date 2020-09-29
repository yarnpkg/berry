import {Plugin, Project, SettingsType} from '@yarnpkg/core';

import {PatchFetcher}                  from './PatchFetcher';
import {PatchResolver}                 from './PatchResolver';
import PatchCommit                     from './commands/patchCommit';
import Patch                           from './commands/patch';
import * as patchUtils                 from './patchUtils';

export {patchUtils};

interface PatchHooks {
  getBuiltinPatch?: (
    project: Project,
    name: string,
  ) => Promise<string | null | void>,
}

/** @deprecated use Hooks from @yarnpkg/core instead */
export type Hooks = PatchHooks;

declare module '@yarnpkg/core' {
  interface ConfigurationValueMap {
    enableInlineHunks: boolean;
  }

  interface Hooks extends PatchHooks {
  }
}

const plugin: Plugin = {
  configuration: {
    enableInlineHunks: {
      description: `If true, the installs will print unmatched patch hunks`,
      type: SettingsType.BOOLEAN,
      default: false,
    },
  },
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
