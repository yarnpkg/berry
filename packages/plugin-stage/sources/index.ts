import {Plugin, Project} from '@yarnpkg/core';
import {PortablePath}    from '@yarnpkg/fslib';

import stage             from './commands/stage';

interface StageHooks {
  populateYarnPaths?: (
    project: Project,
    definePath: (path: PortablePath | null) => void,
  ) => Promise<void>,
}

/** @deprecated use Hooks from @yarnpkg/core instead */
export type Hooks = StageHooks;

declare module '@yarnpkg/core' {
  export interface Hooks extends StageHooks {}
}

const plugin: Plugin = {
  commands: [
    stage,
  ],
  hooks: {populateYarnPaths: undefined},
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
