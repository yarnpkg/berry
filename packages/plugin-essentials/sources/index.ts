import {Descriptor, Plugin, SettingsType} from '@berry/core';
import {Workspace}                        from '@berry/core';

import entry                              from './commands/_entry';
import add                                from './commands/add';
import bin                                from './commands/bin';
import cleanCache                         from './commands/cache/clean';
import setConfig                          from './commands/config/set';
import config                             from './commands/config';
import help                               from './commands/help';
import install                            from './commands/install';
import link                               from './commands/link';
import node                               from './commands/node';
import remove                             from './commands/remove';
import run                                from './commands/run';
import setResolutionPolicy                from './commands/set/resolution';
import setVersionPolicy                   from './commands/set/version';
import up                                 from './commands/up';
import why                                from './commands/why';
import foreachWorkspaces                  from './commands/workspaces/foreach';
import listWorkspaces                     from './commands/workspaces/list';
import * as suggestUtils                  from './suggestUtils';

export {suggestUtils};

export interface Hooks {
  afterWorkspaceDependencyAddition?: (
    workspace: Workspace,
    target: suggestUtils.Target,
    descriptor: Descriptor,
  ) => Promise<void>,

  afterWorkspaceDependencyReplacement?: (
    workspace: Workspace,
    target: suggestUtils.Target,
    fromDescriptor: Descriptor,
    toDescriptor: Descriptor,
  ) => Promise<void>;

  afterWorkspaceDependencyRemoval?: (
    workspace: Workspace,
    target: suggestUtils.Target,
    descriptor: Descriptor,
  ) => Promise<void>,
};

const plugin: Plugin = {
  configuration: {
    frozenInstalls: {
      description: `If true, prevents the install command from modifying the lockfile`,
      type: SettingsType.BOOLEAN,
      default: false,
    },
  },
  commands: [
    cleanCache,
    setConfig,
    setResolutionPolicy,
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
    up,
    why,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
