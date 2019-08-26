import {Hooks as CoreHooks, Plugin, Project, SettingsType} from '@yarnpkg/core';
import {Filename, NodeFS, PortablePath, ppath, xfs}        from '@yarnpkg/fslib';
import {Hooks as StageHooks}                               from '@yarnpkg/plugin-stage';

import {PnpLinker}                                         from './PnpLinker';
import unplug                                              from './commands/unplug';

export const getPnpPath = (project: Project) => ppath.join(project.cwd, `.pnp.js` as Filename);

async function setupScriptEnvironment(project: Project, env: {[key: string]: string}, makePathWrapper: (name: string, argv0: string, args: Array<string>) => Promise<void>) {
  const pnpPath: PortablePath = getPnpPath(project);
  const pnpRequire = `--require ${NodeFS.fromPortablePath(pnpPath)}`;

  if (xfs.existsSync(pnpPath)) {
    let nodeOptions = env.NODE_OPTIONS || ``;

    nodeOptions = nodeOptions.replace(/\s*--require\s+\S*\.pnp\.js\s*/g, ` `).trim();
    nodeOptions = nodeOptions ? `${pnpRequire} ${nodeOptions}` : pnpRequire;

    env.NODE_OPTIONS = nodeOptions;
  }
}

function populateYarnPaths(project: Project, definePath: (path: string | null) => void) {
  definePath(getPnpPath(project));

  definePath(project.configuration.get(`pnpDataPath`));
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
    pnpFallbackMode: {
      description: `If true, the generated PnP loader will follow the top-level fallback rule`,
      type: SettingsType.STRING,
      default: `dependencies-only`,
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
