import {Plugin, Project, Workspace}   from '@berry/core';

import pack                           from './commands/pack';
import * as packUtils                 from './packUtils';

export {packUtils};

export interface Hooks {
  populateYarnPaths?: (
    project: Project,
    definePath: (path: string | null) => void,
  ) => Promise<void>,

  beforeWorkspacePacking?: (
    workspace: Workspace,
    rawManifest: object,
  ) => Promise<void>|void;
}

const beforeWorkspacePacking = (workspace: Workspace, rawManifest: any) => {
  if (rawManifest.publishConfig) {
    if (rawManifest.publishConfig.main)
      rawManifest.main = rawManifest.publishConfig.main;

    if (rawManifest.publishConfig.module) {
      rawManifest.module = rawManifest.publishConfig.module;
    }
  }
}

const plugin: Plugin = {
  hooks: {
    beforeWorkspacePacking,
  } as Hooks,
  commands: [
    pack,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
