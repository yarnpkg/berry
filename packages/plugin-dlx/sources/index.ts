import {Plugin}      from '@yarnpkg/core';

import CreateCommand from './commands/create';
import DlxCommand    from './commands/dlx';

export {CreateCommand};
export {DlxCommand};

const plugin: Plugin = {
  commands: [
    CreateCommand,
    DlxCommand,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
