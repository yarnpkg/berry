import {Plugin}  from '@berry/core';

import foreach   from './commands/foreach';
import workspace from './commands/workspace';

const plugin: Plugin = {
  commands: [
    foreach,
    workspace,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
