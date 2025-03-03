import {Plugin, SettingsType} from '@yarnpkg/core';
import {PortablePath}         from '@yarnpkg/fslib';

import {PnpmLinker}           from './PnpmLinker';

export {PnpmLinker};

declare module '@yarnpkg/core' {
  interface ConfigurationValueMap {
    pnpmStoreFolder: PortablePath;
  }
}

const plugin: Plugin = {
  configuration: {
    pnpmStoreFolder: {
      description: `By default, the store is stored in the 'node_modules/.store' of the project. Sometimes in CI scenario's it is convenient to store this in a different location so it can be cached and reused.`,
      type: SettingsType.ABSOLUTE_PATH,
      default: `./node_modules/.store`,
    },
  },
  linkers: [
    PnpmLinker,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
