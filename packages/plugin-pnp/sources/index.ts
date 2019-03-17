import {Plugin, Project, SettingsType} from '@berry/core';
import {Hooks as StageHooks}           from '@berry/plugin-stage';

import {PnpLinker}                     from './PnpLinker';

function populateYarnPaths(project: Project, definePath: (path: string | null) => void) {
  definePath(project.configuration.get(`pnpDataPath`));
  definePath(project.configuration.get(`pnpPath`));
  definePath(project.configuration.get(`pnpUnpluggedFolder`));
}

const plugin: Plugin = {
  hooks: {
    populateYarnPaths,
  } as (
    StageHooks
  ),
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
    pnpEnableInlining: {
      description: `If true, the PnP data will be inlined along with the generated loader`,
      type: SettingsType.BOOLEAN,
      default: true,
    },
    pnpUnpluggedFolder: {
      description: `Folder where the unplugged packages must be stored`,
      type: SettingsType.ABSOLUTE_PATH,
      default: `./.yarn/unplugged`,
    },
    pnpDataPath: {
      description: `Path of the file where the PnP data (used by the loader) must be written`,
      type: SettingsType.ABSOLUTE_PATH,
      default: `./.pnp.data.json`,
    },
    pnpPath: {
      description: `Path of the file where the PnP loader must be written`,
      type: SettingsType.ABSOLUTE_PATH,
      default: `./.pnp.js`,
    },
  },
  linkers: [
    PnpLinker,
  ],
};

export default plugin;
