import {Plugin}   from '@berry/core';

import hubCommand from './commands/hub';

const plugin: Plugin = {
  commands: [
    hubCommand,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
