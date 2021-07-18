import {BaseCommand, WorkspaceRequiredError}                      from '@yarnpkg/cli';
import {Cache, Configuration, Project, StreamReport, structUtils} from '@yarnpkg/core';
import {npath, ppath}                                             from '@yarnpkg/fslib';
import {Command, Option, Usage, UsageError}                       from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class LinkCommand extends BaseCommand {
  static paths = [
    [`link`],
  ];

  static usage: Usage = Command.Usage({
    description: `connect the local project to another one`,
    details: `
      This command will set a new \`resolutions\` field in the project-level manifest and point it to the workspace at the specified location (even if part of another project).
    `,
    examples: [[
      `Register a remote workspace for use in the current project`,
      `$0 link ~/ts-loader`,
    ], [
      `Register all workspaces from a remote project for use in the current project`,
      `$0 link ~/jest --all`,
    ]],
  });

  all = Option.Boolean(`-A,--all`, false, {
    description: `Link all workspaces belonging to the target project to the current one`,
  });

  private = Option.Boolean(`-p,--private`, false, {
    description: `Also link private workspaces belonging to the target project to the current one`,
  });

  relative = Option.Boolean(`-r,--relative`, false, {
    description: `Link workspaces using relative paths instead of absolute paths`,
  });

  destination = Option.String();

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);
    const cache = await Cache.find(configuration);

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    await project.restoreInstallState({
      restoreResolutions: false,
    });

    const absoluteDestination = ppath.resolve(this.context.cwd, npath.toPortablePath(this.destination));

    const configuration2 = await Configuration.find(absoluteDestination, this.context.plugins, {useRc: false, strict: false});
    const {project: project2, workspace: workspace2} = await Project.find(configuration2, absoluteDestination);

    if (project.cwd === project2.cwd)
      throw new UsageError(`Invalid destination; Can't link the project to itself`);

    if (!workspace2)
      throw new WorkspaceRequiredError(project2.cwd, absoluteDestination);

    const topLevelWorkspace = project.topLevelWorkspace;
    const linkedWorkspaces = [];

    if (this.all) {
      for (const workspace of project2.workspaces)
        if (workspace.manifest.name && (!workspace.manifest.private || this.private))
          linkedWorkspaces.push(workspace);

      if (linkedWorkspaces.length === 0) {
        throw new UsageError(`No workspace found to be linked in the target project`);
      }
    } else {
      if (!workspace2.manifest.name)
        throw new UsageError(`The target workspace doesn't have a name and thus cannot be linked`);

      if (workspace2.manifest.private && !this.private)
        throw new UsageError(`The target workspace is marked private - use the --private flag to link it anyway`);

      linkedWorkspaces.push(workspace2);
    }

    for (const workspace of linkedWorkspaces) {
      const fullName = structUtils.stringifyIdent(workspace.locator);
      const target = this.relative
        ? ppath.relative(project.cwd, workspace.cwd)
        : workspace.cwd;

      topLevelWorkspace.manifest.resolutions.push({
        pattern: {descriptor: {fullName}},
        reference: `portal:${target}`,
      });
    }

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async (report: StreamReport) => {
      await project.install({cache, report});
    });

    return report.exitCode();
  }
}
