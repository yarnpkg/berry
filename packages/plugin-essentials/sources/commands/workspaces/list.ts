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
      for (const workspace of project.workspaces) {
        if (!manifest.name)
          continue;

        const {manifest} = workspace;

        const workspaceDependencies = new Set();
        const mismatchedWorkspaceDependencies = new Set();

        for (const dependencyType of DEPENDENCY_TYPES) {
          for (const descriptor of manifest.getForScope(dependencyType)) {
            const matchingWorkspaces = project.findWorkspacesByDescriptor(descriptor);

            if (matchingWorkspaces.length === 0) {
              if (project.workspacesByIdent.has(descriptor)) {
                mismatchedWorkspaceDependencies.add(descriptor);
              }
            } else {
              for (const workspaceDependency of matchingWorkspaces) {
                workspaceDependencies.add(workspaceDependency)
              }
            }
          }
        }

        stdout.write(JSON.stringify({
          location: workspace.relativeCwd,
          name: structUtils.stringifyIdent(manifest.name),
          
          workspaceDependencies: Array.from(workspaceDependencies).map(workspace => {
            return workspace.relativeCwd;
          }),
          mismatchedWorkspaceDependencies: Array.from(mismatchedWorkspaceDependencies).map(descriptor => {
            return structUtils.stringifyDescriptor(descriptor);
          }),
        }) + `\n`);
      }
    } else {
      for (const cwd of project.workspacesByCwd.keys()) {
        stdout.write(`${cwd}\n`);
      }
    }
    return 0;
  });
