import {Plugin, Project} from '@berry/core';

import stage             from './commands/stage';
import { PortablePath } from '@berry/fslib';

export interface Hooks {
  populateYarnPaths?: (
    project: Project,
    definePath: (path: PortablePath | null) => void,
  ) => Promise<void>,
}

const plugin: Plugin = {
  commands: [
    stage,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
