import {Plugin, Project, SettingsType} from '@yarnpkg/core';

import {PatchFetcher}                  from './PatchFetcher';
import {PatchResolver}                 from './PatchResolver';
import PatchCommit                     from './commands/patchCommit';
import Patch                           from './commands/patch';
import * as patchUtils                 from './patchUtils';

export {patchUtils};

export interface Hooks {
  getBuiltinPatch?: (
    project: Project,
    name: string,
  ) => Promise<string | null | void>,
}

declare module '@yarnpkg/core' {
  interface ConfigurationValueMap {
    enableInlineHunks: boolean;
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
