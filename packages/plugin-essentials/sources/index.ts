import {Descriptor, Plugin, SettingsType} from '@yarnpkg/core';
import {Workspace}                        from '@yarnpkg/core';

import add                                from './commands/add';
import bin                                from './commands/bin';
import cleanCache                         from './commands/cache/clean';
import getConfig                          from './commands/config/get';
import setConfig                          from './commands/config/set';
import config                             from './commands/config';
import clipanionEntry                     from './commands/entries/clipanion';
import helpEntry                          from './commands/entries/help';
import runEntry                           from './commands/entries/run';
import versionEntry                       from './commands/entries/version';
import install                            from './commands/install';
import link                               from './commands/link';
import node                               from './commands/node';
import pluginImport                       from './commands/plugin/import';
import pluginList                         from './commands/plugin/list';
import pluginRuntime                      from './commands/plugin/runtime';
import remove                             from './commands/remove';
import runIndex                           from './commands/runIndex';
import run                                from './commands/run';
import setResolutionPolicy                from './commands/set/resolution';
import setVersionFromSources              from './commands/set/version/sources';
import setVersionPolicy                   from './commands/set/version';
import up                                 from './commands/up';
import why                                from './commands/why';
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
    enableImmutableInstalls: {
      description: `If true, prevents the install command from modifying the lockfile`,
      type: SettingsType.BOOLEAN,
      default: false,
    },

    defaultSemverRangePrefix: {
      description: `The default save prefix: '^', '~' or ''`,
      type: SettingsType.STRING,
      default: suggestUtils.Modifier.CARET,
    },
  },
  commands: [
    cleanCache,
    getConfig,
    setConfig,
    setResolutionPolicy,
    setVersionFromSources,
    setVersionPolicy,
    listWorkspaces,
    clipanionEntry,
    helpEntry,
    runEntry,
    versionEntry,
    add,
    bin,
    config,
    install,
    link,
    node,
    pluginImport,
    pluginList,
    pluginRuntime,
    remove,
    runIndex,
    run,
    up,
    why,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
