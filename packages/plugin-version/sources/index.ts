import {Plugin, SettingsType} from '@berry/core';

import versionApply           from './commands/version/apply';
import versionMajor           from './commands/version/major';
import versionMinor           from './commands/version/minor';
import versionPatch           from './commands/version/patch';

const plugin: Plugin = {
  commands: [
    versionApply,
    versionMajor,
    versionMinor,
    versionPatch,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
