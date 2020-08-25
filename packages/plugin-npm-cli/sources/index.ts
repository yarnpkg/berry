
import {Plugin, SettingsType} from '@yarnpkg/core';

import npmInfo                from './commands/npm/info';
import npmLogin               from './commands/npm/login';
import npmLogout              from './commands/npm/logout';
import npmPublish             from './commands/npm/publish';
import npmTagAdd              from './commands/npm/tag/add';
import npmTagList             from './commands/npm/tag/list';
import npmTagRemove           from './commands/npm/tag/remove';
import npmWhoami              from './commands/npm/whoami';

const plugin: Plugin = {
  configuration: {
    npmPublishAccess: {
      description: `Default access of the published packages`,
      type: SettingsType.STRING,
      default: null,
    },
  },
  commands: [
    npmInfo,
    npmLogin,
    npmLogout,
    npmPublish,
    npmTagAdd,
    npmTagList,
    npmTagRemove,
    npmWhoami,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
