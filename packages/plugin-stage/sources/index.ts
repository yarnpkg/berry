import {Plugin, Project} from '@yarnpkg/core';
import {PortablePath}    from '@yarnpkg/fslib';

import stage             from './commands/stage';

export interface Hooks {
  populateYarnPaths?: (
    project: Project,
    definePath: (path: PortablePath | null) => void,
  ) => Promise<void>;
}

const plugin: Plugin = {
  commands: [
    stage,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
