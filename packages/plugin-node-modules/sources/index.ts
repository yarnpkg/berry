import {Plugin, SettingsType}               from '@yarnpkg/core';
import {NodeModulesHoistingLimits}          from '@yarnpkg/pnpify';

import {NodeModulesLinker, NodeModulesMode} from './NodeModulesLinker';
import {PnpLooseLinker}                     from './PnpLooseLinker';

declare module '@yarnpkg/core' {
  interface ConfigurationValueMap {
    nmHoistingLimits: NodeModulesHoistingLimits;
    nmMode: NodeModulesMode;
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
      default: NodeModulesHoistingLimits.NONE,
    },
    nmMode: {
      description: `If set to "hardlinks" Yarn will utilize hardlinks to reduce disk space consumption inside node_modules directories. With "cas" Yarn will use global content addressable storage to reduce node_modules size across projects that use "cas" option.`,
      type: SettingsType.STRING,
      values: [
        NodeModulesMode.CLASSIC,
        NodeModulesMode.HARDLINKS,
        NodeModulesMode.CAS,
      ],
      default: NodeModulesMode.CLASSIC,
    },
  },
  linkers: [
    NodeModulesLinker,
    PnpLooseLinker,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
