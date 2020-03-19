import {BaseCommand, WorkspaceRequiredError}                              from '@yarnpkg/cli';
import {Cache, Configuration, Manifest, Project, StreamReport, Workspace} from '@yarnpkg/core';
import {Command, Usage}                                                   from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class WorkspacesFocus extends BaseCommand {
  @Command.Boolean(`--json`)
  json: boolean = false;

  static usage: Usage = Command.Usage({
    category: `Workspace-related commands`,
    description: `install a single workspace and its dependencies`,
    details: `
      This command will run an install as if the current workspace (and all other workspaces it depends on) was the only one in the project.

      Note that this command is only very moderately useful when using zero-installs, since the cache will contain all the packages anyway - meaning that the only difference between a full install and a focused install would just be a few extra lines in the \`.pnp.js\` file, at the cost of introducing an extra complexity.

      If the \`--json\` flag is set the output will follow a JSON-stream output also known as NDJSON (https://github.com/ndjson/ndjson-spec).
    `,
  });

  @Command.Path(`workspaces`, `focus`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);
    const cache = await Cache.find(configuration);

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    const requiredWorkspaces = new Set<Workspace>([workspace]);

    // First we compute the dependency chain to see what workspaces are
    // dependencies of the one we're trying to focus on.
    //
    // Note: remember that new elements can be added in a set even while
    // iterating over it (because they're added at the end)

    for (const workspace of requiredWorkspaces) {
      for (const dependencyType of Manifest.hardDependencies) {
        for (const descriptor  of workspace.manifest.getForScope(dependencyType).values()) {
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
      if (requiredWorkspaces.has(workspace))
        continue;

      workspace.manifest.dependencies.clear();
      workspace.manifest.peerDependencies.clear();
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
