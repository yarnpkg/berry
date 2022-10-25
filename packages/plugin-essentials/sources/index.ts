import {Descriptor, Plugin, SettingsType, Package, formatUtils} from '@yarnpkg/core';
import {Workspace}                                              from '@yarnpkg/core';
import {isCI}                                                   from 'ci-info';

import AddCommand                                               from './commands/add';
import BinCommand                                               from './commands/bin';
import CacheCleanCommand                                        from './commands/cache/clean';
import ConfigGetCommand                                         from './commands/config/get';
import ConfigSetCommand                                         from './commands/config/set';
import ConfigUnsetCommand                                       from './commands/config/unset';
import ConfigCommand                                            from './commands/config';
import DedupeCommand                                            from './commands/dedupe';
import ClipanionCommand                                         from './commands/entries/clipanion';
import HelpCommand                                              from './commands/entries/help';
import EntryCommand                                             from './commands/entries/run';
import VersionCommand                                           from './commands/entries/version';
import ExecCommand                                              from './commands/exec';
import ExplainPeerRequirementsCommand                           from './commands/explain/peerRequirements';
import ExplainCommand                                           from './commands/explain';
import InfoCommand                                              from './commands/info';
import YarnCommand                                              from './commands/install';
import LinkCommand                                              from './commands/link';
import NodeCommand                                              from './commands/node';
import PluginCheckCommand                                       from './commands/plugin/check';
import PluginImportSourcesCommand                               from './commands/plugin/import/sources';
import PluginImportCommand                                      from './commands/plugin/import';
import PluginListCommand                                        from './commands/plugin/list';
import PluginRemoveCommand                                      from './commands/plugin/remove';
import PluginRuntimeCommand                                     from './commands/plugin/runtime';
import RebuildCommand                                           from './commands/rebuild';
import RemoveCommand                                            from './commands/remove';
import RunIndexCommand                                          from './commands/runIndex';
import RunCommand                                               from './commands/run';
import SetResolutionCommand                                     from './commands/set/resolution';
import SetVersionSourcesCommand                                 from './commands/set/version/sources';
import SetVersionCommand                                        from './commands/set/version';
import UnlinkCommand                                            from './commands/unlink';
import UpCommand                                                from './commands/up';
import WhyCommand                                               from './commands/why';
import WorkspacesListCommand                                    from './commands/workspaces/list';
import WorkspaceCommand                                         from './commands/workspace';
import * as dedupeUtils                                         from './dedupeUtils';
import * as suggestUtils                                        from './suggestUtils';

export {AddCommand};
export {BinCommand};
export {CacheCleanCommand};
export {ConfigGetCommand};
export {ConfigSetCommand};
export {ConfigUnsetCommand};
export {ConfigCommand};
export {DedupeCommand};
export {ClipanionCommand};
export {HelpCommand};
export {EntryCommand};
export {VersionCommand};
export {ExecCommand};
export {ExplainPeerRequirementsCommand};
export {ExplainCommand};
export {InfoCommand};
export {YarnCommand};
export {LinkCommand};
export {NodeCommand};
export {PluginImportSourcesCommand};
export {PluginCheckCommand};
export {PluginImportCommand};
export {PluginListCommand};
export {PluginRemoveCommand};
export {PluginRuntimeCommand};
export {RebuildCommand};
export {RemoveCommand};
export {RunIndexCommand};
export {RunCommand};
export {SetResolutionCommand};
export {SetVersionSourcesCommand};
export {SetVersionCommand};
export {UnlinkCommand};
export {UpCommand};
export {WhyCommand};
export {WorkspacesListCommand};
export {WorkspaceCommand};
export {dedupeUtils};
export {suggestUtils};

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
    preferReuse: boolean;
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

    preferReuse: {
      description: `If true, \`yarn add\` will attempt to reuse the most common dependency range in other workspaces.`,
      type: SettingsType.BOOLEAN,
      default: false,
    },
  },
  commands: [
    CacheCleanCommand,
    ConfigGetCommand,
    ConfigSetCommand,
    ConfigUnsetCommand,
    SetResolutionCommand,
    SetVersionSourcesCommand,
    SetVersionCommand,
    WorkspacesListCommand,
    ClipanionCommand,
    HelpCommand,
    EntryCommand,
    VersionCommand,
    AddCommand,
    BinCommand,
    ConfigCommand,
    DedupeCommand,
    ExecCommand,
    ExplainPeerRequirementsCommand,
    ExplainCommand,
    InfoCommand,
    YarnCommand,
    LinkCommand,
    UnlinkCommand,
    NodeCommand,
    PluginCheckCommand,
    PluginImportSourcesCommand,
    PluginImportCommand,
    PluginRemoveCommand,
    PluginListCommand,
    PluginRuntimeCommand,
    RebuildCommand,
    RemoveCommand,
    RunIndexCommand,
    RunCommand,
    UpCommand,
    WhyCommand,
    WorkspaceCommand,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
