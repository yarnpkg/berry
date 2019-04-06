import {Plugin, SettingsType} from '@berry/core';

import dlx                    from './commands/dlx';

const plugin: Plugin = {
  commands: [
    dlx,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
