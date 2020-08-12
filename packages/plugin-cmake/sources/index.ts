import {Plugin, SettingsType, Hooks} from '@yarnpkg/core';

import {CmakeLinker}                 from './CmakeLinker';
import * as folderUtils              from './folderUtils';

const plugin: Plugin<Hooks> = {
  configuration: {
    cmakeVendorFolder: {
      description: `Path where the packages will be extracted for later use`,
      type: SettingsType.ABSOLUTE_PATH,
      default: `./.yarn/vendors/cmake`,
    },
  },
  hooks: {
    async setupScriptEnvironment(project, env, makePathWrapper) {
      env.CMAKE_YARN_DEFINITION_FILE = folderUtils.getCmakeDefsPath({
        project,
      });
    },
  },
  linkers: [
    CmakeLinker,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
