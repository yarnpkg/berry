import {Plugin} from '@berry/core';

import foreach  from './commands/foreach';

const plugin: Plugin = {
  commands: [
    foreach,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
