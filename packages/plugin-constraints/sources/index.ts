import {Plugin, SettingsType} from '@yarnpkg/core';

import queryConstraints       from './commands/constraints/query';
import sourceConstraints      from './commands/constraints/source';
import constraints            from './commands/constraints';

const plugin: Plugin = {
  configuration: {
    constraintsPath: {
      description: `The path of the constraints file.`,
      type: SettingsType.ABSOLUTE_PATH,
      default: `./constraints.pro`,
    },
  },
  commands: [
    queryConstraints,
    sourceConstraints,
    constraints,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
