import {Plugin, Project, SettingsType} from '@yarnpkg/core';
import {PortablePath}                  from '@yarnpkg/fslib';

import {PatchFetcher}                  from './PatchFetcher';
import {PatchResolver}                 from './PatchResolver';
import PatchCommit                     from './commands/patchCommit';
import Patch                           from './commands/patch';
import * as patchUtils                 from './patchUtils';

export {patchUtils};

export interface Hooks {
  /**
   * Registers a builtin patch that can be referenced using the dedicated
   * syntax: `patch:builtin<name>`. This is for instance how the TypeScript
   * patch is automatically registered.
   */
  getBuiltinPatch?: (
    project: Project,
    name: string,
  ) => Promise<string | null | void>;
}

declare module '@yarnpkg/core' {
  interface ConfigurationValueMap {
    enableInlineHunks: boolean;
    patchFolder: PortablePath;
  }
}

const plugin: Plugin = {
  configuration: {
    enableInlineHunks: {
      description: `If true, the installs will print unmatched patch hunks`,
      type: SettingsType.BOOLEAN,
      default: false,
    },
    patchFolder: {
      description: `Folder where the patch files must be written`,
      type: SettingsType.ABSOLUTE_PATH,
      default: `./.yarn/patches`,
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
