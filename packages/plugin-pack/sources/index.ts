import {Plugin, Project} from '@berry/core';

import pack              from './commands/pack';
import * as packUtils    from './packUtils';

export {packUtils};

export interface Hooks {
  populateYarnPaths?: (
    project: Project,
    definePath: (path: string | null) => void,
  ) => Promise<void>,
}

const plugin: Plugin = {
  commands: [
    pack,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
