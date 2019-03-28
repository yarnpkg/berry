import {WorkspaceRequiredError}                                         from '@berry/cli';
import {Configuration, Cache, Descriptor, PluginConfiguration, Project} from '@berry/core';
import {StreamReport, Workspace}                                        from '@berry/core';
import {structUtils}                                                    from '@berry/core';
import {Writable}                                                       from 'stream';

import * as suggestUtils                                                from '../suggestUtils';
import {Hooks}                                                          from '..';

export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`remove [... names] [-A,--all]`)
  .describe(`remove dependencies from the project`)

  .detail(`
    This command will remove the specified packages from the current workspace. If the \`-A,--all\` option is set, the operation will be applied to all workspaces from the current project.
  `)

  .example(
    `Removes a dependency from the current project`,
    `yarn remove lodash`,
  )

  .example(
    `Removes a dependency from all workspaces at once`,
    `yarn remove lodash --all`,
  )

  .action(async ({cwd, stdout, names, all}: {cwd: string, stdout: Writable, names: Array<string>, all: boolean}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);
    const {project, workspace} = await Project.find(configuration, cwd);
    const cache = await Cache.find(configuration);

    if (!workspace)
      throw new WorkspaceRequiredError(cwd);

    const affectedWorkspaces = all
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
      for (const entry of names) {
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

      const report = await StreamReport.start({configuration, stdout}, async (report: StreamReport) => {
        await project.install({cache, report});
      });

      return report.exitCode();
    }
  });
