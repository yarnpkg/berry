import {BaseCommand}                                                                        from '@yarnpkg/cli';
import {Configuration, Manifest, Project, StreamReport, structUtils, Descriptor, Workspace} from '@yarnpkg/core';
import {Command, Usage}                                                                     from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class WorkspacesListCommand extends BaseCommand {
  @Command.Boolean(`-v,--verbose`)
  verbose: boolean = false;

  @Command.Boolean(`--json`)
  json: boolean = false;

  static usage: Usage = Command.Usage({
    category: `Workspace-related commands`,
    description: `list all available workspaces`,
    details: `
      This command will print the list of all workspaces in the project. If both the \`-v,--verbose\` and \`--json\` options are set, Yarn will also return the cross-dependencies between each workspaces (useful when you wish to automatically generate Buck / Bazel rules).

      If the \`--json\` flag is set the output will follow a JSON-stream output also known as NDJSON (https://github.com/ndjson/ndjson-spec).
    `,
  });

  @Command.Path(`workspaces`, `list`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project} = await Project.find(configuration, this.context.cwd);

    const report = await StreamReport.start({
      configuration,
      json: this.json,
      stdout: this.context.stdout,
    }, async report => {
      for (const workspace of project.workspaces) {
        const {manifest} = workspace;

        let extra;
        if (this.verbose) {
          const workspaceDependencies = new Set<Workspace>();
          const mismatchedWorkspaceDependencies = new Set<Descriptor>();

          for (const dependencyType of Manifest.hardDependencies) {
            for (const [identHash, descriptor]  of manifest.getForScope(dependencyType)) {
              const matchingWorkspace = project.tryWorkspaceByDescriptor(descriptor);

              if (matchingWorkspace === null) {
                if (project.workspacesByIdent.has(identHash)) {
                  mismatchedWorkspaceDependencies.add(descriptor);
                }
              } else {
                workspaceDependencies.add(matchingWorkspace);
              }
            }
          }

          extra = {
            workspaceDependencies: Array.from(workspaceDependencies).map(workspace => {
              return workspace.relativeCwd;
            }),

            mismatchedWorkspaceDependencies: Array.from(mismatchedWorkspaceDependencies).map(descriptor => {
              return structUtils.stringifyDescriptor(descriptor);
            }),
          };
        }

        report.reportInfo(null, `${workspace.relativeCwd}`);
        report.reportJson({
          location: workspace.relativeCwd,

          name: manifest.name
            ? structUtils.stringifyIdent(manifest.name)
            : null,

          ...extra,
        });
      }
    });

    return report.exitCode();
  }
}
