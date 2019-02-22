import {Plugin, SettingsType} from '@berry/core';

import init                   from './commands/init';

const plugin: Plugin = {
  configuration: {
    initLicense: {
      description: `License used when creating packages via the init command`,
      type: SettingsType.STRING,
      default: null,
    },
    initScope: {
      description: `Scope used when creating packages via the init command`,
      type: SettingsType.STRING,
      default: null,
    },
    initVersion: {
      description: `Version used when creating packages via the init command`,
      type: SettingsType.STRING,
      default: null,
    },
  },
  commands: [
    init,
  ],
};

export default plugin;
