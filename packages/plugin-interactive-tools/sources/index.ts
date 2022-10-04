import {Plugin}                  from '@yarnpkg/core';

import SearchCommand             from './commands/search';
import UpgradeInteractiveCommand from './commands/upgrade-interactive';

export {SearchCommand};
export {UpgradeInteractiveCommand};

const plugin: Plugin = {
  commands: [
    SearchCommand,
    UpgradeInteractiveCommand,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
