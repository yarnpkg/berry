import {Configuration, Plugin, Project} from '@berry/core';
import execa                            from 'execa';
import {Readable, Writable}             from 'stream';

export default (concierge: any, plugins: Map<string, Plugin>) => concierge

  .command(`exec <file> [... args]`)
  .describe(`execute a shell command`)
  .flags({proxyArguments: true})

  .action(async ({cwd, stdin, stdout, stderr, file, args}: {cwd: string, stdin: Readable, stdout: Writable, stderr: Writable, file: string, args: Array<string>}) => {
    const configuration = await Configuration.find(cwd, plugins);
    const {workspace} = await Project.find(configuration, cwd);

    return await execa(file, args, {cwd: workspace.cwd, stdin, stdout, stderr});
  });
