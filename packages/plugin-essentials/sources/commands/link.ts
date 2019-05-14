import {WorkspaceRequiredError}                                                        from '@berry/cli';
import {Cache, Configuration, PluginConfiguration, Project, StreamReport, structUtils} from '@berry/core';
import {NodeFS, PortablePath, ppath}                                                   from '@berry/fslib';
import {UsageError}                                                                    from 'clipanion';
import {Writable}                                                                      from 'stream';

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`link <destination> [--all] [-p,--private] [-r,--relative]`)
  .describe(`connect the local project to another one`)

  .detail(`
    This command will set a new \`resolutions\` field in the project-level manifest and point it to the workspace at the specified location (even if part of another project).

    If the \`--all\` option is set, all workspaces belonging to the target project will be linked to the current one.

    There is no \`yarn unlink\` command. To unlink the workspaces from the current project one must revert the changes made to the \`resolutions\` field.
  `)

  .example(
    `Register a remote workspace for use in the current project`,
    `yarn link ~/ts-loader`,
  )

  .example(
    `Register all workspaces from a remote project for use in the current project`,
    `yarn link ~/jest --all`,
  )

  .action(async ({cwd, stdout, destination, all, private: priv, relative}: {cwd: PortablePath, stdout: Writable, destination: string, all: boolean, private: boolean, relative: boolean}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);
    const {project, workspace} = await Project.find(configuration, cwd);
    const cache = await Cache.find(configuration);

    if (!workspace)
      throw new WorkspaceRequiredError(cwd);

    const absoluteDestination = ppath.resolve(cwd, NodeFS.toPortablePath(destination));

    const configuration2 = await Configuration.find(absoluteDestination, pluginConfiguration);
    const {project: project2, workspace: workspace2} = await Project.find(configuration2, absoluteDestination);

    if (!workspace2)
      throw new WorkspaceRequiredError(absoluteDestination);

    const topLevelWorkspace = project.topLevelWorkspace;
    const linkedWorkspaces = [];

    if (all) {
      for (const workspace of project2.workspaces)
        if (workspace.manifest.name && (!workspace.manifest.private || priv))
          linkedWorkspaces.push(workspace);

      if (linkedWorkspaces.length === 0) {
        throw new UsageError(`No workspace found to be linked in the target project`);
      }
    } else {
      if (!workspace2.manifest.name)
        throw new UsageError(`The target workspace doesn't have a name and thus cannot be linked`);

      if (workspace2.manifest.private && !priv)
        throw new UsageError(`The target workspace is marked private - use the --private flag to link it anyway`);

      linkedWorkspaces.push(workspace2);
    }

    for (const workspace of linkedWorkspaces) {
      const fullName = structUtils.stringifyIdent(workspace.locator);
      const target = relative
        ? ppath.relative(project.cwd, workspace.cwd)
        : workspace.cwd;

      topLevelWorkspace.manifest.resolutions.push({
        pattern: {descriptor: {fullName}},
        reference: `portal:${target}`,
      });
    }

    const report = await StreamReport.start({configuration, stdout}, async (report: StreamReport) => {
      await project.install({cache, report});
    });

    return report.exitCode();
  });
