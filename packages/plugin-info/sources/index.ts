import {Plugin} from '@yarnpkg/core';

import info     from './commands/info';

const plugin: Plugin = {
  commands: [
    info,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
