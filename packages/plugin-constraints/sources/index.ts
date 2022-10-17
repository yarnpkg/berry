import {Plugin, SettingsType}   from '@yarnpkg/core';
import {PortablePath}           from '@yarnpkg/fslib';

import ConstraintsQueryCommand  from './commands/constraints/query';
import ConstraintsSourceCommand from './commands/constraints/source';
import ConstraintsCheckCommand  from './commands/constraints';

export {ConstraintsQueryCommand};
export {ConstraintsSourceCommand};
export {ConstraintsCheckCommand};

declare module '@yarnpkg/core' {
  interface ConfigurationValueMap {
    constraintsPath: PortablePath;
  }
}

const plugin: Plugin = {
  configuration: {
    constraintsPath: {
      description: `The path of the constraints file.`,
      type: SettingsType.ABSOLUTE_PATH,
      default: `./constraints.pro`,
    },
  },
  commands: [
    ConstraintsQueryCommand,
    ConstraintsSourceCommand,
    ConstraintsCheckCommand,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
