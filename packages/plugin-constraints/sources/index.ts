import {Plugin}          from '@berry/core';

import applyConstraints  from './commands/constraints/apply';
import checkConstraints  from './commands/constraints/check';
import detailConstraints from './commands/constraints/detail';
import sourceConstraints from './commands/constraints/source';

const plugin: Plugin = {
  commands: [
    applyConstraints,
    checkConstraints,
    detailConstraints,
    sourceConstraints,
  ],
};

export default plugin;
