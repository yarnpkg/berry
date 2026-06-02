import {Plugin, SettingsType} from '@yarnpkg/core';
import {PortablePath}         from '@yarnpkg/fslib';

import {PnpmLinker}           from './PnpmLinker';

export {PnpmLinker};

declare module '@yarnpkg/core' {
  interface ConfigurationValueMap {
    pnpmStoreFolder: PortablePath;
    pnpmInstallConcurrency: number;
  }
}

const plugin: Plugin = {
  configuration: {
    pnpmStoreFolder: {
      description: `By default, the store is stored in the 'node_modules/.store' of the project. Sometimes in CI scenario's it is convenient to store this in a different location so it can be cached and reused.`,
      type: SettingsType.ABSOLUTE_PATH,
      default: `./node_modules/.store`,
    },
    pnpmInstallConcurrency: {
      description: `Maximum number of packages the pnpm linker will install in parallel. Lower this on monorepos with very large caches if you hit "Couldn't allocate enough memory" from the bundled libzip WASM heap.`,
      type: SettingsType.NUMBER,
      default: 10,
    },
  },
  linkers: [
    PnpmLinker,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
