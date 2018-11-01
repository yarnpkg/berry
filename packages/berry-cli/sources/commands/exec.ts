import {Configuration, Project} from '@berry/core';
import {Readable, Writable}     from 'stream';

import * as execUtils           from '../utils/execUtils';

export default (concierge: any) => concierge

  .command(`exec <file> [... args]`)
  .describe(`execute a shell command`)
  .flags({proxyArguments: true})

  .action(async ({cwd, stdin, stdout, stderr, file, args}: {cwd: string, stdin: Readable, stdout: Writable, stderr: Writable, file: string, args: Array<string>}) => {
    const configuration = await Configuration.find(cwd);
    const {workspace} = await Project.find(configuration, cwd);

    return await execUtils.execFile(file, args, {cwd: workspace.cwd, stdin, stdout, stderr});
  });
