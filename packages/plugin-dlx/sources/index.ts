import {Plugin, SettingsType} from '@berry/core';

import dlx                    from './commands/dlx';

const plugin: Plugin = {
  commands: [
    dlx,
  ],
};

export default plugin;
