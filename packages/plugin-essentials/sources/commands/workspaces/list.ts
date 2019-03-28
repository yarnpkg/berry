import {Configuration, PluginConfiguration, Project} from '@berry/core';
import {Writable}                                    from 'stream';

export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`workspaces list`)

  .categorize(`Workspace commands`)
  .describe(`list all available workspaces`)

  .action(async ({cwd, stdout}: {cwd: string, stdout: Writable}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);
    const {project} = await Project.find(configuration, cwd);

    for (const cwd of project.workspacesByCwd.keys())
      stdout.write(`${cwd}\n`);

    return 0;
  });
