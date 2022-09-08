import {Plugin, Project} from '@yarnpkg/core';
import {PortablePath}    from '@yarnpkg/fslib';

import StageCommand      from './commands/stage';
import * as stageUtils   from './stageUtils';

export {StageCommand};
export {stageUtils};

export interface Hooks {
  populateYarnPaths?: (
    project: Project,
    definePath: (path: PortablePath | null) => void,
  ) => Promise<void>;
}

const plugin: Plugin = {
  commands: [
    StageCommand,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
