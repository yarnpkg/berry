import {WorkspaceRequiredError}                                                         from '@berry/cli';
import {CommandContext, Configuration, Cache, Descriptor, Project}                      from '@berry/core';
import {StreamReport, Workspace}                                                        from '@berry/core';
import {structUtils}                                                                    from '@berry/core';
import {Command}                                                                        from 'clipanion';

import * as suggestUtils                                                                from '../suggestUtils';
import {Hooks}                                                                          from '..';

// eslint-disable-next-line arca/no-default-export
export default class RemoveCommand extends Command<CommandContext> {
  @Command.Boolean(`-A,--all`)
  all: boolean = false;

  @Command.Rest()
  names: Array<string> = [];

  static usage = Command.Usage({
    description: `remove dependencies from the project`,
    details: `
      This command will remove the specified packages from the current workspace. If the \`-A,--all\` option is set, the operation will be applied to all workspaces from the current project.
    `,
    examples: [[
      `Remove a dependency from the current project`,
      `yarn remove lodash`,
    ], [
      `Remove a dependency from all workspaces at once`,
      `yarn remove lodash --all`,
    ]],
  });

  @Command.Path(`remove`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);
    const cache = await Cache.find(configuration);

    if (!workspace)
      throw new WorkspaceRequiredError(this.context.cwd);

    const affectedWorkspaces = this.all
      ? project.workspaces
      : [workspace];

    const targets = [
      suggestUtils.Target.REGULAR,
      suggestUtils.Target.DEVELOPMENT,
      suggestUtils.Target.PEER,
    ];

    let hasChanged = false;

    const afterWorkspaceDependencyRemovalList: Array<[
      Workspace,
      suggestUtils.Target,
      Descriptor
    ]> = [];

    for (const workspace of affectedWorkspaces) {
      for (const entry of this.names) {
        const ident = structUtils.parseIdent(entry);

        for (const target of targets) {
          const current = workspace.manifest[target].get(ident.identHash);

          if (typeof current !== `undefined`) {
            workspace.manifest[target].delete(ident.identHash);

            afterWorkspaceDependencyRemovalList.push([
              workspace,
              target,
              current,
            ]);

            hasChanged = true;
          }
        }
      }
    }

    if (hasChanged) {
      await configuration.triggerMultipleHooks(
        (hooks: Hooks) => hooks.afterWorkspaceDependencyRemoval,
        afterWorkspaceDependencyRemovalList,
      );

      const report = await StreamReport.start({
        configuration,
        stdout: this.context.stdout,
      }, async (report: StreamReport) => {
        await project.install({cache, report});
      });

      return report.exitCode();
    }
  }
}
