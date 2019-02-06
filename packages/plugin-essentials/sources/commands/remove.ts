import {WorkspaceRequiredError}                              from '@berry/cli';
import {Configuration, Cache, Plugin, Project, StreamReport} from '@berry/core';
import {structUtils}                                         from '@berry/core';
import {Writable}                                            from 'stream';

export default (concierge: any, plugins: Map<string, Plugin>) => concierge

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
    const configuration = await Configuration.find(cwd, plugins);
    const {project, workspace} = await Project.find(configuration, cwd);
    const cache = await Cache.find(configuration);

    if (!workspace)
      throw new WorkspaceRequiredError(cwd);

    const report = await StreamReport.start({configuration, stdout}, async (report: StreamReport) => {
      const affectedWorkspaces = all
        ? project.workspaces
        : [workspace];

      for (const workspace of affectedWorkspaces) {
        for (const entry of names) {
          const ident = structUtils.parseIdent(entry);

          workspace.manifest.dependencies.delete(ident.identHash);
          workspace.manifest.devDependencies.delete(ident.identHash);
          workspace.manifest.peerDependencies.delete(ident.identHash);
        }
      }

      await project.install({cache, report});
    });

    return report.exitCode();
  });
