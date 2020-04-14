import {Plugin, SettingsType} from '@yarnpkg/core';

import versionApply           from './commands/version/apply';
import versionCheck           from './commands/version/check';
import version                from './commands/version';

const plugin: Plugin = {
  configuration: {
    changesetBaseRef: {
      description: 'The base git ref that the current HEAD is compared against when detecting changes. Supports git branches, tags, and commits.',
      type: SettingsType.STRING,
      default: null,
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
    versionApply,
    versionCheck,
    version,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
