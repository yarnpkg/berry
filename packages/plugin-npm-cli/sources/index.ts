import {Plugin, SettingsType} from '@yarnpkg/core';

import info                   from './commands/npm/info';
import login                  from './commands/npm/login';
import logout                 from './commands/npm/logout';
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
    info,
    login,
    logout,
    npmPublish,
    whoami,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
