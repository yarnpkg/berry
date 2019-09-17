import {Plugin, SettingsType} from '@yarnpkg/core';

import {CMakeLinker}          from './CMakeLinker';

const plugin: Plugin = {
  configuration: {
    cmakeUnpluggedFolder: {
      description: `Folder where the unplugged packages must be stored`,
      type: SettingsType.ABSOLUTE_PATH,
      default: `./.yarn/unplugged/cmake`,
    },
  },
  linkers: [
    CMakeLinker,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
