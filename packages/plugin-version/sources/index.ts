import {miscUtils, Plugin, SettingsType} from '@yarnpkg/core';
import {PortablePath}                    from '@yarnpkg/fslib';

import VersionApplyCommand               from './commands/version/apply';
import VersionCheckCommand               from './commands/version/check';
import VersionCommand                    from './commands/version';
import * as versionUtils                 from './versionUtils';

export {VersionApplyCommand};
export {VersionCheckCommand};
export {VersionCommand};
export {versionUtils};

declare module '@yarnpkg/core' {
  interface ConfigurationValueMap {
    releaseTagPatterns: Array<string>;
    releaseTypePatterns: miscUtils.ToMapValue<{patch: Array<string>, minor: Array<string>, major: Array<string>}>;
    deferredVersionFolder: PortablePath;
    preferDeferredVersions: boolean;
  }
}

const plugin: Plugin = {
  configuration: {
    releaseTagPatterns: {
      description: `Patterns to use when generating the tags for the new releases`,
      type: SettingsType.STRING,
      default: [`{version}`],
      isArray: true,
    },
    releaseTypePatterns: {
      description: `Patterns to use to detect whether commits should lead to major / minor / patch version bumps`,
      type: SettingsType.SHAPE,
      properties: {
        patch: {
          description: `Patterns to use to detect whether commits must be deployed in patch releases or higher`,
          type: SettingsType.STRING,
          default: [`^fix(\\([^)]+\\))?:`],
          isArray: true,
        },
        minor: {
          description: `Patterns to use to detect whether commits must be deployed in minor releases or higher`,
          type: SettingsType.STRING,
          default: [`^feat(\\([^)]+\\))?:`],
          isArray: true,
        },
        major: {
          description: `Patterns to use to detect whether commits must be deployed in major releases`,
          type: SettingsType.STRING,
          default: [`^[a-z](\\([^)]\\))?!:`, `(^|\\n)\\s+BREAKING CHANGE:`],
          isArray: true,
        },
      },
    },
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
