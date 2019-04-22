import {Hooks as CoreHooks, Plugin, Project, SettingsType} from '@berry/core';
import {NodeFS, xfs}                                       from '@berry/fslib';
import {Hooks as StageHooks}                               from '@berry/plugin-stage';

import {PnpLinker}                                         from './PnpLinker';
import unplug                                              from './commands/unplug';

async function setupScriptEnvironment(project: Project, env: {[key: string]: string}, makePathWrapper: (name: string, argv0: string, args: Array<string>) => Promise<void>) {
  const pnpPath = NodeFS.fromPortablePath(project.configuration.get(`pnpPath`));
  const pnpRequire = `--require ${pnpPath}`;

  if (xfs.existsSync(pnpPath)) {
    let nodeOptions = env.NODE_OPTIONS || ``;

    nodeOptions = nodeOptions.replace(/\s*--require\s+\S*\.pnp\.js\s*/g, ` `).trim();
    nodeOptions = nodeOptions ? `${pnpRequire} ${nodeOptions}` : pnpRequire;

    env.NODE_OPTIONS = nodeOptions;
  }
}

function populateYarnPaths(project: Project, definePath: (path: string | null) => void) {
  definePath(project.configuration.get(`pnpDataPath`));
  definePath(project.configuration.get(`pnpPath`));
  definePath(project.configuration.get(`pnpUnpluggedFolder`));
}

const plugin: Plugin = {
  hooks: {
    populateYarnPaths,
    setupScriptEnvironment,
  } as (
    CoreHooks &
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
  commands: [
    unplug,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
