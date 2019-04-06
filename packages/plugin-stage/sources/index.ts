import {Plugin, Project} from '@berry/core';

import stage             from './commands/stage';

export interface Hooks {
  populateYarnPaths?: (
    project: Project,
    definePath: (path: string | null) => void,
  ) => Promise<void>,
}

const plugin: Plugin = {
  commands: [
    stage,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
