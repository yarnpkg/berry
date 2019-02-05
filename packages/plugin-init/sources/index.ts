import {Plugin} from '@berry/core';

import init     from './commands/init';

const plugin: Plugin = {
  commands: [
    init,
  ],
};

export default plugin;
