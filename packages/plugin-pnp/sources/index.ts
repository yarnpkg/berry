import {Plugin, SettingsType} from '@berry/core';

import {PnpLinker}            from './PnpLinker';

const plugin: Plugin = {
  configuration: {
    pnpShebang: {
      type: SettingsType.STRING,
      default: `#!/usr/bin/env node`,
    },
    pnpIgnorePattern: {
      type: SettingsType.STRING,
      default: null,
    },
    pnpUnpluggedFolder: {
      type: SettingsType.ABSOLUTE_PATH,
      default: `./.berry/pnp/unplugged`,
    },
    pnpUnpluggedPackages: {
      type: SettingsType.ABSOLUTE_PATH,
      default: [],
    },
    pnpPath: {
      type: SettingsType.ABSOLUTE_PATH,
      default: `./.pnp.js`,
    },
  },
  linkers: [
    PnpLinker,
  ],
};

export default plugin;
