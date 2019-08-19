import {Plugin}     from '@berry/core';

import versionApply from './commands/version/apply';
import versionCheck from './commands/version/check';
import version      from './commands/version';

const plugin: Plugin = {
  commands: [
    versionApply,
    versionCheck,
    version,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
