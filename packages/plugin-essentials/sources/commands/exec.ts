import {BaseCommand}            from '@yarnpkg/cli';
import {Configuration, Project} from '@yarnpkg/core';
import {execUtils, scriptUtils} from '@yarnpkg/core';
import {xfs}                    from '@yarnpkg/fslib';
import {Command}                from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class ExecCommand extends BaseCommand {
  @Command.String()
  commandName!: string;

  @Command.Proxy()
  args: Array<string> = [];

  @Command.Path(`exec`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project} = await Project.find(configuration, this.context.cwd);

    return await xfs.mktempPromise(async binFolder => {
      const {code} = await execUtils.pipevp(this.commandName, this.args, {
        cwd: this.context.cwd,
        stdin: this.context.stdin,
        stdout: this.context.stdout,
        stderr: this.context.stderr,
        env: await scriptUtils.makeScriptEnv({project, binFolder}),
      });

      return code;
    });
  }
}
