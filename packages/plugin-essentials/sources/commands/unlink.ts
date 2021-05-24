import {BaseCommand, WorkspaceRequiredError}                                 from '@yarnpkg/cli';
import {Cache, Configuration, miscUtils, Project, StreamReport, structUtils} from '@yarnpkg/core';
import {npath, ppath}                                                        from '@yarnpkg/fslib';
import {Command, Option, Usage, UsageError}                                  from 'clipanion';
import micromatch                                                            from 'micromatch';

// eslint-disable-next-line arca/no-default-export
export default class UnlinkCommand extends BaseCommand {
  static paths = [
    [`unlink`],
  ];

  static usage: Usage = Command.Usage({
    description: `disconnect the local project from another one`,
    details: `
      This command will remove any resolutions in the project-level manifest that would have been added via a yarn link with similar arguments.
    `,
    examples: [[
      `Unregister a remote workspace in the current project`,
      `$0 unlink ~/ts-loader`,
    ], [
      `Unregister all workspaces from a remote project in the current project`,
      `$0 unlink ~/jest --all`,
    ], [
      `Unregister all previously linked workspaces`,
      `$0 unlink --all`,
    ], [
      `Unregister all workspaces matching a glob`,
      `$0 unlink '@babel/*'`,
    ]],
  });

  all = Option.Boolean(`-A,--all`, false, {
    description: `Unlink all workspaces belonging to the target project from the current one`,
  });

  leadingArgument = Option.String({
    required: false,
  });

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);
    const cache = await Cache.find(configuration);

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    const topLevelWorkspace = project.topLevelWorkspace;
    const workspacesToUnlink = new Set<string>();

    if (!this.leadingArgument && this.all) {
      for (const {pattern, reference} of topLevelWorkspace.manifest.resolutions) {
        if (reference.startsWith(`portal:`)) {
          workspacesToUnlink.add(pattern.descriptor.fullName);
        }
      }
    }

    if (this.leadingArgument) {
      const absoluteDestination = ppath.resolve(this.context.cwd, npath.toPortablePath(this.leadingArgument));
      if (miscUtils.isPathLike(this.leadingArgument)) {
        const configuration2 = await Configuration.find(absoluteDestination, this.context.plugins, {useRc: false, strict: false});
        const {project: project2, workspace: workspace2} = await Project.find(configuration2, absoluteDestination);

        if (!workspace2)
          throw new WorkspaceRequiredError(project2.cwd, absoluteDestination);

        if (this.all) {
          for (const workspace of project2.workspaces)
            if (workspace.manifest.name)
              workspacesToUnlink.add(structUtils.stringifyIdent(workspace.locator));

          if (workspacesToUnlink.size === 0) {
            throw new UsageError(`No workspace found to be unlinked in the target project`);
          }
        } else {
          if (!workspace2.manifest.name)
            throw new UsageError(`The target workspace doesn't have a name and thus cannot be unlinked`);

          workspacesToUnlink.add(structUtils.stringifyIdent(workspace2.locator));
        }
      } else {
        const fullNames = [...topLevelWorkspace.manifest.resolutions.map(({pattern}) => pattern.descriptor.fullName)];
        for (const fullName of micromatch(fullNames, this.leadingArgument)) {
          workspacesToUnlink.add(fullName);
        }
      }
    }

    topLevelWorkspace.manifest.resolutions = topLevelWorkspace.manifest.resolutions.filter(({pattern}) => {
      return !workspacesToUnlink.has(pattern.descriptor.fullName);
    });

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async (report: StreamReport) => {
      await project.install({cache, report});
    });

    return report.exitCode();
  }
}
