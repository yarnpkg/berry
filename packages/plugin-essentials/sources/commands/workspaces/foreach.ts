import {Configuration, PluginConfiguration, Project} from '@berry/core';
import { PortablePath } from '@berry/fslib';

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`workspaces foreach [... args]`)
  .flags({proxyArguments: true})

  .categorize(`Workspace-related commands`)
  .describe(`run a command on all workspaces`)

  .action(async ({cwd, args, ... env}: {cwd: PortablePath, args: Array<string>}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);
    const {project} = await Project.find(configuration, cwd);

    for (const cwd of project.workspacesByCwd.keys())
      await clipanion.run(null, args, {... env, cwd});

    return 0;
  });
