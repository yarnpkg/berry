import {Plugin, SettingsType}      from '@yarnpkg/core';
import {NodeModulesHoistingLimits} from '@yarnpkg/pnpify';

import {NodeModulesLinker}         from './NodeModulesLinker';
import {PnpLooseLinker}            from './PnpLooseLinker';

declare module '@yarnpkg/core' {
  interface ConfigurationValueMap {
    nmHoistingLimits: NodeModulesHoistingLimits;
    nmHardlinks: boolean;
  }
}

const plugin: Plugin = {
  configuration: {
    nmHoistingLimits: {
      description: `Prevent packages to be hoisted past specific levels`,
      type: SettingsType.STRING,
      values: [
        NodeModulesHoistingLimits.WORKSPACES,
        NodeModulesHoistingLimits.DEPENDENCIES,
        NodeModulesHoistingLimits.NONE,
      ],
      default: `none`,
    },
    nmHardlinks: {
      description: `Use hardlinks to reduce disk space consumption by node_modules installs`,
      type: SettingsType.BOOLEAN,
      default: false,
    },
  },
  linkers: [
    NodeModulesLinker,
    PnpLooseLinker,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
