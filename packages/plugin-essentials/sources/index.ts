import {Descriptor, Plugin, SettingsType, Package, formatUtils} from '@yarnpkg/core';
import {Workspace}                                              from '@yarnpkg/core';
import {isCI}                                                   from 'ci-info';

import add                                                      from './commands/add';
import bin                                                      from './commands/bin';
import cleanCache                                               from './commands/cache/clean';
import getConfig                                                from './commands/config/get';
import setConfig                                                from './commands/config/set';
import unsetConfig                                              from './commands/config/unset';
import config                                                   from './commands/config';
import dedupe                                                   from './commands/dedupe';
import clipanionEntry                                           from './commands/entries/clipanion';
import helpEntry                                                from './commands/entries/help';
import runEntry                                                 from './commands/entries/run';
import versionEntry                                             from './commands/entries/version';
import exec                                                     from './commands/exec';
import explainPeerRequirements                                  from './commands/explain/peerRequirements';
import explain                                                  from './commands/explain';
import info                                                     from './commands/info';
import install                                                  from './commands/install';
import link                                                     from './commands/link';
import node                                                     from './commands/node';
import pluginImportSources                                      from './commands/plugin/import/sources';
import pluginImport                                             from './commands/plugin/import';
import pluginList                                               from './commands/plugin/list';
import pluginRemove                                             from './commands/plugin/remove';
import pluginRuntime                                            from './commands/plugin/runtime';
import rebuild                                                  from './commands/rebuild';
import remove                                                   from './commands/remove';
import runIndex                                                 from './commands/runIndex';
import run                                                      from './commands/run';
import setResolutionPolicy                                      from './commands/set/resolution';
import setVersionFromSources                                    from './commands/set/version/sources';
import setVersionPolicy                                         from './commands/set/version';
import unlink                                                   from './commands/unlink';
import up                                                       from './commands/up';
import why                                                      from './commands/why';
import listWorkspaces                                           from './commands/workspaces/list';
import workspace                                                from './commands/workspace';
import * as dedupeUtils                                         from './dedupeUtils';
import * as suggestUtils                                        from './suggestUtils';

export {
  dedupeUtils,
  suggestUtils,
};

export interface Hooks {
  /**
   * Called when a new dependency is added to a workspace. Note that this hook
   * is only called by the CLI commands like `yarn add` - manually adding the
   * dependencies into the manifest and running `yarn install` won't trigger
   * it.
   */
  afterWorkspaceDependencyAddition?: (
    workspace: Workspace,
    target: suggestUtils.Target,
    descriptor: Descriptor,
    strategies: Array<suggestUtils.Strategy>
  ) => Promise<void>;

  /**
   * Called when a dependency range is replaced inside a workspace. Note that
   * this hook is only called by the CLI commands like `yarn add` - manually
   * updating the dependencies from the manifest and running `yarn install`
   * won't trigger it.
   */
  afterWorkspaceDependencyReplacement?: (
    workspace: Workspace,
    target: suggestUtils.Target,
    fromDescriptor: Descriptor,
    toDescriptor: Descriptor,
  ) => Promise<void>;

  /**
   * Called when a dependency range is removed from a workspace. Note that
   * this hook is only called by the CLI commands like `yarn remove` - manually
   * removing the dependencies from the manifest and running `yarn install`
   * won't trigger it.
   */
  afterWorkspaceDependencyRemoval?: (
    workspace: Workspace,
    target: suggestUtils.Target,
    descriptor: Descriptor,
  ) => Promise<void>;

  /**
   * Called by `yarn info`. The `extra` field is the set of parameters passed
   * to the `-X,--extra` flag. Calling `registerData` will add a new set of
   * data that will be added to the package information.
   *
   * For instance, an "audit" plugin could check in `extra` whether the user
   * requested audit information (via `-X audit`), and call `registerData`
   * with those information (retrieved dynamically) if they did.
   */
  fetchPackageInfo?: (
    pkg: Package,
    extra: Set<string>,
    registerData: (namespace: string, data: Array<formatUtils.Tuple> | {[key: string]: formatUtils.Tuple | undefined}) => void,
  ) => Promise<void>;
}

declare module '@yarnpkg/core' {
  interface ConfigurationValueMap {
    enableImmutableInstalls: boolean;
    // Can't use Modifier here because there are actually two instances of this module:
    // One in packages/plugin-essentials and one virtual package.
    // Defining this property with two different enum instances leads to a compiler error.
    defaultSemverRangePrefix: `^` | `~` | ``;
  }
}

const plugin: Plugin = {
  configuration: {
    enableImmutableInstalls: {
      description: `If true (the default on CI), prevents the install command from modifying the lockfile`,
      type: SettingsType.BOOLEAN,
      default: isCI,
    },

    defaultSemverRangePrefix: {
      description: `The default save prefix: '^', '~' or ''`,
      type: SettingsType.STRING,
      values: [`^`, `~`, ``],
      default: suggestUtils.Modifier.CARET,
    },
  },
  commands: [
    cleanCache,
    getConfig,
    setConfig,
    unsetConfig,
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
    dedupe,
    exec,
    explainPeerRequirements,
    explain,
    info,
    install,
    link,
    unlink,
    node,
    pluginImportSources,
    pluginImport,
    pluginRemove,
    pluginList,
    pluginRuntime,
    rebuild,
    remove,
    runIndex,
    run,
    up,
    why,
    workspace,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
