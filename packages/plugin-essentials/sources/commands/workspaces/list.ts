import {Configuration, MessageName, PluginConfiguration, Project, StreamReport, structUtils} from '@berry/core';
import {Writable}                                                                            from 'stream';

const DEPENDENCY_TYPES = ['devDependencies', 'dependencies'];

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`workspaces list [-v,--verbose] [--json]`)

  .categorize(`Workspace-related commands`)
  .describe(`list all available workspaces`)

  .action(async ({cwd, stdout, verbose, json}: {cwd: string, stdout: Writable, verbose: boolean, json: boolean}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);
    const {project} = await Project.find(configuration, cwd);

    const report = await StreamReport.start({configuration, json, stdout}, async report => {
      for (const workspace of project.workspaces) {
        const {manifest} = workspace;

        let extra;
        if (verbose) {
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

        report.reportInfo(MessageName.UNNAMED, `${workspace.relativeCwd}`);
        report.reportJson({
          location: workspace.relativeCwd,

          name: manifest.name
            ? structUtils.stringifyIdent(manifest.name)
            : null,

          ... extra,
        });
      }
    });

    return report.exitCode();
  });
