import {Plugin} from '@berry/core';

import pack     from './commands/pack';

const plugin: Plugin = {
  commands: [
    pack,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
