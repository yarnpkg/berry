import {Plugin, SettingsType} from '@yarnpkg/core';

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
    initFields: {
      description: `Additional fields to set when creating packages via the init command`,
      type: SettingsType.MAP,
      valueDefinition: {
        description: ``,
        type: SettingsType.ANY,
      },
    },
    initEditorConfig: {
      description: `Extra rules to define in the generator editorconfig`,
      type: SettingsType.MAP,
      valueDefinition: {
        description: ``,
        type: SettingsType.ANY,
      },
    },
  },
  commands: [
    init,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
