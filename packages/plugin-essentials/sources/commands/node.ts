import {Configuration, Plugin, Project} from '@berry/core';
import {scriptUtils}                    from '@berry/core';
import execa                            from 'execa';
import {Readable, Writable}             from 'stream';

export default (concierge: any, plugins: Map<string, Plugin>) => concierge

  .command(`node [... args]`)
  .describe(`run node with the hook already setup`)
  .flags({proxyArguments: true})

  .action(async ({cwd, stdin, stdout, stderr, args}: {cwd: string, stdin: Readable, stdout: Writable, stderr: Writable, args: Array<string>}) => {
    const configuration = await Configuration.find(cwd, plugins);
    const {project} = await Project.find(configuration, cwd);

    const env = await scriptUtils.makeScriptEnv(project);

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
