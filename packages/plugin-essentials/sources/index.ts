import {Plugin}          from '@berry/core';

import setConfig         from './commands/x-config/set';
import setVersionPolicy  from './commands/x-policies/set-version';
import foreachWorkspaces from './commands/x-workspaces/foreach';
import listWorkspaces    from './commands/x-workspaces/list';
import entry             from './commands/_entry';
import add               from './commands/add';
import bin               from './commands/bin';
import config            from './commands/config';
import exec              from './commands/exec';
import help              from './commands/help';
import install           from './commands/install';
import node              from './commands/node';
import remove            from './commands/remove';
import run               from './commands/run';

const plugin: Plugin = {
  commands: [
    setConfig,
    setVersionPolicy,
    foreachWorkspaces,
    listWorkspaces,
    entry,
    add,
    bin,
    config,
    exec,
    help,
    install,
    node,
    remove,
    run,
  ],
};

export default plugin;
