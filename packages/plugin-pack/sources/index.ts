import {Plugin, Project, Workspace}   from '@berry/core';

import pack                           from './commands/pack';
import {writePublishConfigToManifest} from './hook';
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

const plugin: Plugin = {
  hooks: {
    beforeWorkspacePacking: writePublishConfigToManifest,
  },
  commands: [
    pack,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
