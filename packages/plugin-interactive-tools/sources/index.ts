import {Plugin}           from '@yarnpkg/core';

import upgradeInteractive from './commands/upgrade-interactive';

const plugin: Plugin = {
  commands: [
    upgradeInteractive,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
