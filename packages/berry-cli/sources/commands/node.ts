import {Configuration, Project} from '@berry/core';
import execa                    from 'execa';
import {existsSync}             from 'fs';
import {Readable, Writable}     from 'stream';

import * as execUtils           from '../utils/execUtils';
import {plugins}                from '../plugins';

export default (concierge: any) => concierge

  .command(`node [... args]`)
  .describe(`run node with the hook already setup`)
  .flags({proxyArguments: true})

  .action(async ({cwd, stdin, stdout, stderr, args}: {cwd: string, stdin: Readable, stdout: Writable, stderr: Writable, args: Array<string>}) => {
    const configuration = await Configuration.find(cwd, plugins);
    const {project} = await Project.find(configuration, cwd);

    const env = await execUtils.makeExecEnv(project);

    try {
      await execa(`node`, args, {cwd, stdin, stdout, stderr, env});
    } catch (error) {
      if (error.cmd) {
        return error.code;
      } else {
        throw error;
      }
    }
  });
