import {Plugin, SettingsType} from '@yarnpkg/core';
import {PortablePath}         from '@yarnpkg/fslib';

import VersionApplyCommand    from './commands/version/apply';
import VersionCheckCommand    from './commands/version/check';
import VersionCommand         from './commands/version';
import * as versionUtils      from './versionUtils';

export {VersionApplyCommand};
export {VersionCheckCommand};
export {VersionCommand};
export {versionUtils};

declare module '@yarnpkg/core' {
  interface ConfigurationValueMap {
    deferredVersionFolder: PortablePath;
    preferDeferredVersions: boolean;
  }
}

const plugin: Plugin = {
  configuration: {
    deferredVersionFolder: {
      description: `Folder where are stored the versioning files`,
      type: SettingsType.ABSOLUTE_PATH,
      default: `./.yarn/versions`,
    },
    preferDeferredVersions: {
      description: `If true, running \`yarn version\` will assume the \`--deferred\` flag unless \`--immediate\` is set`,
      type: SettingsType.BOOLEAN,
      default: false,
    },
  },
  commands: [
    VersionApplyCommand,
    VersionCheckCommand,
    VersionCommand,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
