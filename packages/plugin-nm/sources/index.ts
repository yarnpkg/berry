import {Hooks, Plugin, SettingsType}        from '@yarnpkg/core';
import {xfs}                                from '@yarnpkg/fslib';
import {NodeModulesHoistingLimits}          from '@yarnpkg/nm';

import {NodeModulesLinker, NodeModulesMode} from './NodeModulesLinker';
import {getGlobalHardlinksStore}            from './NodeModulesLinker';
import {PnpLooseLinker}                     from './PnpLooseLinker';

declare module '@yarnpkg/core' {
  interface ConfigurationValueMap {
    nmHoistingLimits: NodeModulesHoistingLimits;
    nmMode: NodeModulesMode;
    nmSelfReferences: boolean;
  }
}

const plugin: Plugin<Hooks> = {
  hooks: {
    cleanGlobalArtifacts: async configuration => {
      const globalHardlinksDirectory = getGlobalHardlinksStore(configuration);
      await xfs.removePromise(globalHardlinksDirectory);
    },
  },
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
      description: `If set to "hardlinks-local" Yarn will utilize hardlinks to reduce disk space consumption inside "node_modules" directories. With "hardlinks-global" Yarn will use global content addressable storage to reduce "node_modules" size across all the projects using this option.`,
      type: SettingsType.STRING,
      values: [
        NodeModulesMode.CLASSIC,
        NodeModulesMode.HARDLINKS_LOCAL,
        NodeModulesMode.HARDLINKS_GLOBAL,
      ],
      default: NodeModulesMode.CLASSIC,
    },
    nmSelfReferences: {
      description: `If set to 'false' the workspace will not be allowed to require itself and corresponding self-referencing symlink will not be created`,
      type: SettingsType.BOOLEAN,
      default: true,
    },
  },
  linkers: [
    NodeModulesLinker,
    PnpLooseLinker,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
