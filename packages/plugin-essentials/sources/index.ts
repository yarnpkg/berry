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
import help              from './commands/help';
import install           from './commands/install';
import link              from './commands/link';
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
    help,
    install,
    link,
    node,
    remove,
    run,
  ],
};

export default plugin;
