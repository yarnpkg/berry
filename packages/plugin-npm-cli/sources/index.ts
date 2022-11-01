import {Plugin, SettingsType} from '@yarnpkg/core';

import NpmAuditCommand        from './commands/npm/audit';
import NpmInfoCommand         from './commands/npm/info';
import NpmLoginCommand        from './commands/npm/login';
import NpmLogoutCommand       from './commands/npm/logout';
import NpmPublishCommand      from './commands/npm/publish';
import NpmTagAddCommand       from './commands/npm/tag/add';
import NpmTagListCommand      from './commands/npm/tag/list';
import NpmTagRemoveCommand    from './commands/npm/tag/remove';
import NpmWhoamiCommand       from './commands/npm/whoami';
import * as npmAuditUtils     from './npmAuditUtils';

export {npmAuditUtils};
export {NpmAuditCommand};
export {NpmInfoCommand};
export {NpmLoginCommand};
export {NpmLogoutCommand};
export {NpmPublishCommand};
export {NpmTagAddCommand};
export {NpmTagListCommand};
export {NpmTagRemoveCommand};
export {NpmWhoamiCommand};

declare module '@yarnpkg/core' {
  interface ConfigurationValueMap {
    npmPublishAccess: string | null;
    npmAuditExcludePackages: Array<string>;
    npmAuditIgnoreAdvisories: Array<string>;
  }
}

const plugin: Plugin = {
  configuration: {
    npmPublishAccess: {
      description: `Default access of the published packages`,
      type: SettingsType.STRING,
      default: null,
    },
    npmAuditExcludePackages: {
      description: `Array of glob patterns of packages to exclude from npm audit`,
      type: SettingsType.STRING,
      default: [],
      isArray: true,
    },
    npmAuditIgnoreAdvisories: {
      description: `Array of glob patterns of advisory IDs to exclude from npm audit`,
      type: SettingsType.STRING,
      default: [],
      isArray: true,
    },
  },
  commands: [
    NpmAuditCommand,
    NpmInfoCommand,
    NpmLoginCommand,
    NpmLogoutCommand,
    NpmPublishCommand,
    NpmTagAddCommand,
    NpmTagListCommand,
    NpmTagRemoveCommand,
    NpmWhoamiCommand,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
