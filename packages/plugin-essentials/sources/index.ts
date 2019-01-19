import {Plugin}          from '@berry/core';

import setVersionPolicy  from './commands/policies/set-version';
import foreachWorkspaces from './commands/workspaces/foreach';
import listWorkspaces    from './commands/workspaces/list';
import entry             from './commands/_entry';
import add               from './commands/add';
import bin               from './commands/bin';
import exec              from './commands/exec';
import help              from './commands/help';
import install           from './commands/install';
import node              from './commands/node';
import remove            from './commands/remove';
import run               from './commands/run';

const plugin: Plugin = {
  commands: [
    setVersionPolicy,
    foreachWorkspaces,
    listWorkspaces,
    entry,
    add,
    bin,
    exec,
    help,
    install,
    node,
    remove,
    run,
  ],
};

export default plugin;
