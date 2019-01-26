import {Plugin}          from '@berry/core';

import cleanCache        from './commands/cache/clean';
import setConfig         from './commands/config/set';
import setVersionPolicy  from './commands/policies/set-version';
import foreachWorkspaces from './commands/workspaces/foreach';
import listWorkspaces    from './commands/workspaces/list';
import entry             from './commands/_entry';
import add               from './commands/add';
import bin               from './commands/bin';
import config            from './commands/config';
import exec              from './commands/exec';
import help              from './commands/help';
import init              from './commands/init';
import install           from './commands/install';
import node              from './commands/node';
import remove            from './commands/remove';
import run               from './commands/run';

const plugin: Plugin = {
  commands: [
    cleanCache,
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
    init,
    install,
    node,
    remove,
    run,
  ],
};

export default plugin;
