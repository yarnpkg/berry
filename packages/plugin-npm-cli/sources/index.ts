import {Plugin, SettingsType} from '@yarnpkg/core';

import login                  from './commands/npm/login';
import npmPublish             from './commands/npm/publish';
import whoami                 from './commands/npm/whoami';

const plugin: Plugin = {
  configuration: {
    npmPublishAccess: {
      description: `Default access of the published packages`,
      type: SettingsType.STRING,
      default: null,
    },
  },
  commands: [
    login,
    npmPublish,
    whoami,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
