import {BaseCommand}                                                                        from '@yarnpkg/cli';
import {Configuration, Manifest, Project, StreamReport, structUtils, Descriptor, Workspace} from '@yarnpkg/core';
import {gitUtils}                                                                           from '@yarnpkg/plugin-git';
import {Command, Option, Usage, UsageError}                                                 from 'clipanion';

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

      - If both the \`-v,--verbose\` and \`--json\` options are set, Yarn will also return the cross-dependencies between each workspaces (useful when you wish to automatically generate Buck / Bazel rules).

      - If \`--since\` is set, Yarn will only list workspaces that have been modified since the specified ref. By default Yarn will use the refs specified by the \`changesetBaseRefs\` configuration option.
    `,
  });

  since = Option.String(`--since`, {
    description: `Only include workspaces that have been changed since the specified ref.`,
    tolerateBoolean: true,
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

    if (configuration.projectCwd === null)
      throw new UsageError(`This command can only be run from within a Yarn project`);

    const root = this.since ? await gitUtils.getRoot(configuration.projectCwd) : null;
    const base = this.since && root !== null
      ? await gitUtils.fetchBase(root, {baseRefs: typeof this.since === `string` ? [this.since] : configuration.get(`changesetBaseRefs`)})
      : null;

    const report = await StreamReport.start({
      configuration,
      json: this.json,
      stdout: this.context.stdout,
    }, async report => {
      const workspaces = this.since && root !== null
        ? await gitUtils.fetchChangedWorkspaces(root, {base: base!.hash, project})
        : project.workspaces;

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
