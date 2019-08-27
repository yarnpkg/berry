import {Plugin}    from '@yarnpkg/core';

import deduplicate from './commands/deduplicate';

const plugin: Plugin = {
  commands: [
    deduplicate,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
