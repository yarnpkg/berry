import {CommandContext, Configuration, Project, StreamReport, structUtils} from '@berry/core';
import {Command}                                                           from 'clipanion';

const DEPENDENCY_TYPES = ['devDependencies', 'dependencies'];

// eslint-disable-next-line arca/no-default-export
export default class WorkspacesListCommand extends Command<CommandContext> {
  @Command.Boolean(`-v,--verbose`)
  verbose: boolean = false;

  @Command.Boolean(`--json`)
  json: boolean = false;

  static usage = Command.Usage({
    category: `Workspace-related commands`,
    description: `list all available workspaces`,
    details: `
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
          const workspaceDependencies = new Set();
          const mismatchedWorkspaceDependencies = new Set();

          for (const dependencyType of DEPENDENCY_TYPES) {
            for (const [identHash, descriptor]  of manifest.getForScope(dependencyType)) {
              const matchingWorkspaces = project.findWorkspacesByDescriptor(descriptor);

              if (matchingWorkspaces.length === 0) {
                if (project.workspacesByIdent.has(identHash)) {
                  mismatchedWorkspaceDependencies.add(descriptor);
                }
              } else {
                for (const workspaceDependency of matchingWorkspaces) {
                  workspaceDependencies.add(workspaceDependency)
                }
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
