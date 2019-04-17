import {Configuration, PluginConfiguration, Project, Workspace, Descriptor, structUtils} from '@berry/core';
import {Writable}                                                                        from 'stream';

const DEPENDENCY_TYPES = ['devDependencies', 'dependencies'];

interface JsonOutput {
  [key: string]: {
    location: string,
    workspaceDependencies: string [],
    mismatchedWorkspaceDependencies: string []
  }
};
// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`workspaces list [-v,--verbose] [--json]`)

  .categorize(`Workspace commands`)
  .describe(`list all available workspaces`)

  .action(async ({cwd, stdout, verbose, json}: {cwd: string, stdout: Writable, verbose: boolean, json: boolean}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);
    const {project} = await Project.find(configuration, cwd);

    if (verbose && json) {
      const jsonOutput = project.workspaces.reduce((results: JsonOutput, workspace: Workspace) => {
        const { manifest } = workspace;
        if (manifest.name) {
          const workspaceDependencies = new Set();
          const mismatchedWorkspaceDependencies = new Set();
          for(const dependencyType of DEPENDENCY_TYPES) {
            const dependencies = manifest.getForScope(dependencyType);
            dependencies.forEach((descriptor: Descriptor) => {
              const candidateWorkspaces = project.workspacesByIdent.get(descriptor.identHash);
              if (candidateWorkspaces && candidateWorkspaces.length) {
                candidateWorkspaces.forEach((curr: Workspace) => {
                  if (workspace.accepts(descriptor.range)) {
                    if (curr.manifest.name) {
                      workspaceDependencies.add(structUtils.stringifyIdent(curr.manifest.name))
                    }
                  }
                  else {
                    if (curr.manifest.name) {
                      mismatchedWorkspaceDependencies.add(structUtils.stringifyIdent(curr.manifest.name));
                    }
                  }
                });
              }
            });
          }
          results[structUtils.stringifyIdent(manifest.name)] = {
            location: workspace.relativeCwd,
            workspaceDependencies: Array.from(workspaceDependencies),
            mismatchedWorkspaceDependencies: Array.from(mismatchedWorkspaceDependencies),
          };
        }
        return results;
      }, {});
      stdout.write(`${JSON.stringify(jsonOutput, null, 2)}\n`);
    }
    else {
      for (const cwd of project.workspacesByCwd.keys()) {
        stdout.write(`${cwd}\n`);
      }
    }
    return 0;
  });
