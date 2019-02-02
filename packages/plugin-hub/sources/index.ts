import {Plugin}   from '@berry/core';

import hubCommand from './commands/hub';

const plugin: Plugin = {
  commands: [
    hubCommand,
  ],
};

export default plugin;
