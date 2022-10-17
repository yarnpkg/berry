import {Plugin}                 from '@yarnpkg/core';

import WorkspacesFocusCommand   from './commands/focus';
import WorkspacesForeachCommand from './commands/foreach';

export {WorkspacesFocusCommand};
export {WorkspacesForeachCommand};

const plugin: Plugin = {
  commands: [
    WorkspacesFocusCommand,
    WorkspacesForeachCommand,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
