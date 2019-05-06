import {Plugin, SettingsType} from '@berry/core';

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
    npmPublish,
    whoami,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
