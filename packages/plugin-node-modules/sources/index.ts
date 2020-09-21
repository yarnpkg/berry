import {Plugin, Project, SettingsType} from '@yarnpkg/core';
import {Filename, ppath}               from '@yarnpkg/fslib';

import {NodeModulesLinker}             from './NodeModulesLinker';
import {PnpLooseLinker}                from './PnpLooseLinker';

export const getPnpPath = (project: Project) => ppath.join(project.cwd, `.pnp.js` as Filename);

const plugin: Plugin = {
  configuration: {
    nmHoistingLimits: {
      description: `Prevent packages can be hoisted past specific levels`,
      type: SettingsType.STRING,
      values: [`workspaces`, `dependencies`, `none`],
      default: `none`,
    },
  },
  linkers: [
    NodeModulesLinker,
    PnpLooseLinker,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
