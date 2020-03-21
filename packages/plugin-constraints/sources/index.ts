import {Plugin, SettingsType} from '@yarnpkg/core';

import queryConstraints       from './commands/constraints/query';
import sourceConstraints      from './commands/constraints/source';
import constraints            from './commands/constraints';

const plugin: Plugin = {
  configuration: {
    constraintsFilename: {
      description: `This setting defines the name of the files that Yarn looks for when resolving constraints.`,
      type: SettingsType.STRING,
      default: `constraints.pro`,
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
