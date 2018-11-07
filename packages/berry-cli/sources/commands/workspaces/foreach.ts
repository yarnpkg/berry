import {Configuration, Project} from '@berry/core';

export default (concierge: any) => concierge

  .command(`workspaces foreach [... args]`)
  .flags({proxyArguments: true})

  .categorize(`Workspace commands`)
  .describe(`run a command on all workspaces`)

  .action(async ({cwd, args, ... env}: {cwd: string, args: Array<string>}) => {
    const configuration = await Configuration.find(cwd);
    const {project} = await Project.find(configuration, cwd);

    for (const cwd of project.workspacesByCwd.keys())
      await concierge.run(null, args, {... env, cwd});

    return 0;
  });
