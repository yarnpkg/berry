import {Plugin}   from '@berry/core';

import npmPublish from './commands/npm/publish';

const plugin: Plugin = {
  commands: [
    npmPublish,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
