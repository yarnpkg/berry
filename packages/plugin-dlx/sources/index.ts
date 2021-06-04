import {Plugin} from '@yarnpkg/core';

import create   from './commands/create';
import dlx      from './commands/dlx';

const plugin: Plugin = {
  commands: [
    create,
    dlx,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
