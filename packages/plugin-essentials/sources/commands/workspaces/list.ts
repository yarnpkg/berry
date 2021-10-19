import {BaseCommand}                                                                        from '@yarnpkg/cli';
import {Configuration, Manifest, Project, StreamReport, structUtils, Descriptor, Workspace} from '@yarnpkg/core';
import {gitUtils}                                                                           from '@yarnpkg/plugin-git';
import {Command, Option, Usage}                                                             from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class WorkspacesListCommand extends BaseCommand {
  static paths = [
    [`workspaces`, `list`],
  ];

  static usage: Usage = Command.Usage({
    category: `Workspace-related commands`,
    description: `list all available workspaces`,
    details: `
      This command will print the list of all workspaces in the project.

      - If \`--since\` is set, Yarn will only list workspaces that have been modified since the specified ref. By default Yarn will use the refs specified by the \`changesetBaseRefs\` configuration option.

      - If \`-R,--recursive\` is set, Yarn will find workspaces to run the command on by recursively evaluating \`dependencies\` and \`devDependencies\` fields, instead of looking at the \`workspaces\` fields.

      - If both the \`-v,--verbose\` and \`--json\` options are set, Yarn will also return the cross-dependencies between each workspaces (useful when you wish to automatically generate Buck / Bazel rules).
    `,
  });

  since = Option.String(`--since`, {
    description: `Only include workspaces that have been changed since the specified ref.`,
    tolerateBoolean: true,
  });

  recursive = Option.Boolean(`-R,--recursive`, false, {
    description: `Find packages via dependencies/devDependencies instead of using the workspaces field`,
  });

  verbose = Option.Boolean(`-v,--verbose`, false, {
    description: `Also return the cross-dependencies between workspaces`,
  });

  json = Option.Boolean(`--json`, false, {
    description: `Format the output as an NDJSON stream`,
  });

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project} = await Project.find(configuration, this.context.cwd);

    const report = await StreamReport.start({
      configuration,
      json: this.json,
      stdout: this.context.stdout,
    }, async report => {
      const candidates = this.since
        ? await gitUtils.fetchChangedWorkspaces({ref: this.since, project})
        : project.workspaces;

      const workspaces = new Set(candidates);
      if (this.recursive)
        for (const dependents of [...candidates].map(candidate => candidate.getRecursiveWorkspaceDependents()))
          for (const dependent of dependents)
            workspaces.add(dependent);

      for (const workspace of workspaces) {
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
