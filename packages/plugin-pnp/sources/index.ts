import {Plugin, SettingsType} from '@berry/core';

import unplug                 from './commands/unplug';
import {PnpLinker}            from './PnpLinker';

const plugin: Plugin = {
  configuration: {
    pnpShebang: {
      description: `String to prepend to the generated PnP script`,
      type: SettingsType.STRING,
      default: `#!/usr/bin/env node`,
    },
    pnpIgnorePattern: {
      description: `Regex defining a pattern of files that should use the classic resolution`,
      type: SettingsType.STRING,
      default: null,
    },
    pnpUnpluggedFolder: {
      description: `Folder where the unplugged packages must be stored`,
      type: SettingsType.ABSOLUTE_PATH,
      default: `./.berry/pnp/unplugged`,
    },
    pnpUnpluggedPackages: {
      description: `List of packages that must be explicitly unplugged if possible`,
      type: SettingsType.LOCATOR_LOOSE,
      default: [],
    },
    pnpPath: {
      description: `Path of the file where the PnP hook must be written`,
      type: SettingsType.ABSOLUTE_PATH,
      default: `./.pnp.js`,
    },
  },
  commands: [
    unplug,
  ],
  linkers: [
    PnpLinker,
  ],
};

export default plugin;
