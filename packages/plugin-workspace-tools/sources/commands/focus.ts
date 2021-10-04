import {BaseCommand, WorkspaceRequiredError}                              from '@yarnpkg/cli';
import {Cache, Configuration, Manifest, Project, StreamReport, Workspace} from '@yarnpkg/core';
import {structUtils}                                                      from '@yarnpkg/core';
import {Command, Option, Usage}                                           from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class WorkspacesFocus extends BaseCommand {
  static paths = [
    [`workspaces`, `focus`],
  ];

  static usage: Usage = Command.Usage({
    category: `Workspace-related commands`,
    description: `install a single workspace and its dependencies`,
    details: `
      This command will run an install as if the specified workspaces (and all other workspaces they depend on) were the only ones in the project. If no workspaces are explicitly listed, the active one will be assumed.

      Note that this command is only very moderately useful when using zero-installs, since the cache will contain all the packages anyway - meaning that the only difference between a full install and a focused install would just be a few extra lines in the \`.pnp.cjs\` file, at the cost of introducing an extra complexity.

      If the \`-A,--all\` flag is set, the entire project will be installed. Combine with \`--production\` to replicate the old \`yarn install --production\`.
    `,
  });

  json = Option.Boolean(`--json`, false, {
    description: `Format the output as an NDJSON stream`,
  });

  production = Option.Boolean(`--production`, false, {
    description: `Only install regular dependencies by omitting dev dependencies`,
  });

  all = Option.Boolean(`-A,--all`, false, {
    description: `Install the entire project`,
  });

  workspaces = Option.Rest();

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);
    const cache = await Cache.find(configuration);

    await project.restoreInstallState({
      restoreResolutions: false,
    });

    let requiredWorkspaces: Set<Workspace>;
    if (this.all) {
      requiredWorkspaces = new Set(project.workspaces);
    } else if (this.workspaces.length === 0) {
      if (!workspace)
        throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

      requiredWorkspaces = new Set([workspace]);
    } else {
      requiredWorkspaces = new Set(this.workspaces.map(name => {
        return project.getWorkspaceByIdent(structUtils.parseIdent(name));
      }));
    }

    // First we compute the dependency chain to see what workspaces are
    // dependencies of the one we're trying to focus on.
    //
    // Note: remember that new elements can be added in a set even while
    // iterating over it (because they're added at the end)

    for (const workspace of requiredWorkspaces) {
      for (const dependencyType of this.production ? [`dependencies`] : Manifest.hardDependencies) {
        for (const descriptor of workspace.manifest.getForScope(dependencyType).values()) {
          const matchingWorkspace = project.tryWorkspaceByDescriptor(descriptor);

          if (matchingWorkspace === null)
            continue;

          requiredWorkspaces.add(matchingWorkspace);
        }
      }
    }

    // Then we go over each workspace that didn't get selected, and remove all
    // their dependencies.

    for (const workspace of project.workspaces) {
      if (requiredWorkspaces.has(workspace)) {
        if (this.production) {
          workspace.manifest.devDependencies.clear();
        }
      } else {
        workspace.manifest.installConfig = workspace.manifest.installConfig || {};
        workspace.manifest.installConfig.selfReferences = false;
        workspace.manifest.dependencies.clear();
        workspace.manifest.devDependencies.clear();
        workspace.manifest.peerDependencies.clear();
        workspace.manifest.scripts.clear();
      }
    }

    // And finally we can run the install, but we have to make sure we don't
    // persist the project state on the disk (otherwise all workspaces would
    // lose their dependencies!).

    const report = await StreamReport.start({
      configuration,
      json: this.json,
      stdout: this.context.stdout,
      includeLogs: true,
    }, async (report: StreamReport) => {
      await project.install({cache, report, persistProject: false});
    });

    return report.exitCode();
  }
}
