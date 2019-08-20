import {Plugin}          from '@berry/core';

import queryConstraints  from './commands/constraints/query';
import sourceConstraints from './commands/constraints/source';
import constraints       from './commands/constraints';

const plugin: Plugin = {
  commands: [
    queryConstraints,
    sourceConstraints,
    constraints,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
