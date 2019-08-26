import {Plugin} from '@yarnpkg/core';

import dlx      from './commands/dlx';

const plugin: Plugin = {
  commands: [
    dlx,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
