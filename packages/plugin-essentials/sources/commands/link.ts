import {BaseCommand, WorkspaceRequiredError} from '@yarnpkg/cli';
import {Cache, Configuration, Project, structUtils} from '@yarnpkg/core';
import {npath, ppath, constants} from '@yarnpkg/fslib';
import {Command, Option, Usage, UsageError} from 'clipanion';
import {Report} from '../../../yarnpkg-core/sources';

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
      `Register one or more remote workspaces for use in the current project`,
      `$0 link ~/ts-loader ~/jest`,
    ], [
      `Register all workspaces from a remote project for use in the current project`,
      `$0 link ~/jest --all`,
    ]],
  });

  all = Option.Boolean(`-A,--all`, false, {
    description: `Link all workspaces belonging to the target projects to the current one`,
  });

  private = Option.Boolean(`-p,--private`, false, {
    description: `Also link private workspaces belonging to the target projects to the current one`,
  });

  relative = Option.Boolean(`-r,--relative`, false, {
    description: `Link workspaces using relative paths instead of absolute paths`,
  });

  destinations = Option.Rest();

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);
    const cache = await Cache.find(configuration);

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    await project.restoreInstallState({
      restoreResolutions: false,
    });

    const topLevelWorkspace = project.topLevelWorkspace;
    const linkedWorkspaces = [];

    for (const destination of this.destinations) {
      const absoluteDestination = ppath.resolve(this.context.cwd, npath.toPortablePath(destination));

      const configuration2 = await Configuration.find(absoluteDestination, this.context.plugins, {useRc: false, strict: false});
      const {project: project2, workspace: workspace2} = await Project.find(configuration2, absoluteDestination);

      if (project.cwd === project2.cwd)
        throw new UsageError(`Invalid destination '${destination}'; Can't link the project to itself`);

      if (!workspace2)
        throw new WorkspaceRequiredError(project2.cwd, absoluteDestination);

      if (this.all) {
        let found = false;
        for (const workspace of project2.workspaces) {
          if (workspace.manifest.name && (!workspace.manifest.private || this.private)) {
            linkedWorkspaces.push(workspace);
            found = true;
          }
        }

        if (!found) {
          throw new UsageError(`No workspace found to be linked in the target project: ${destination}`);
        }
      } else {
        if (!workspace2.manifest.name)
          throw new UsageError(`The target workspace at '${destination}' doesn't have a name and thus cannot be linked`);

        if (workspace2.manifest.private && !this.private)
          throw new UsageError(`The target workspace at '${destination}' is marked private - use the --private flag to link it anyway`);

        linkedWorkspaces.push(workspace2);
      }
    }

    const processWorkspace = async workspace => {
      const fullName = structUtils.stringifyIdent(workspace.anchoredLocator);
      let target = this.relative
        ? ppath.relative(project.cwd, workspace.cwd)
        : workspace.cwd;

      if (process.platform === `win32`) {
        const windowsPath = npath.fromPortablePath(target);

        if (windowsPath.length >= constants.MAX_PATH) {
          // For virtual packages, try to shorten the path first
          if (structUtils.isVirtualLocator(workspace.anchoredLocator)) {
            const hash = structUtils.slugifyLocator(workspace.anchoredLocator).slice(0, 8);
            const shortName = `${workspace.manifest.name.name}-${hash}`;
            target = ppath.resolve(project.cwd, `node_modules/${shortName}` as any);
          }

          const finalWindowsPath = npath.fromPortablePath(target);
          if (finalWindowsPath.length >= constants.MAX_PATH) {
            target = npath.toPortablePath(`\\\\?\\${finalWindowsPath}`);
          }
        }
      }

      return {
        pattern: {descriptor: {fullName}},
        reference: `portal:${target}`,
      };
    };

    const resolutions = await Promise.all(linkedWorkspaces.map(processWorkspace));
    topLevelWorkspace.manifest.resolutions.push(...resolutions);

    return await project.installWithNewReport({
      stdout: this.context.stdout,
      reportFooter: () => {
        const rows = resolutions.map(({pattern, reference}) => [
          structUtils.prettyIdent(configuration, pattern.descriptor),
          reference,
        ]);

        return `${Report.reportInfo(null, `The following packages have been linked:`)}\n${
          Report.reportIndex(null, rows)}`;
      },
    }, {
      cache,
    });
  }
}