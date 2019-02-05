import {Plugin}          from '@berry/core';

import checkConstraints  from './commands/constraints/check';
import fixConstraints    from './commands/constraints/fix';
import sourceConstraints from './commands/constraints/source';

const plugin: Plugin = {
  commands: [
    fixConstraints,
    checkConstraints,
    sourceConstraints,
  ],
};

export default plugin;
