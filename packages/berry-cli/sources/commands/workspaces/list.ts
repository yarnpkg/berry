import {Configuration, Plugin, Project} from '@berry/core';
import {Writable}                       from 'stream';

export default (concierge: any, plugins: Map<string, Plugin>) => concierge

  .command(`workspaces list`)

  .categorize(`Workspace commands`)
  .describe(`list all available workspaces`)

  .action(async ({cwd, stdout}: {cwd: string, stdout: Writable}) => {
    const configuration = await Configuration.find(cwd, plugins);
    const {project} = await Project.find(configuration, cwd);

    for (const cwd of project.workspacesByCwd.keys())
      stdout.write(`${cwd}\n`);

    return 0;
  });
