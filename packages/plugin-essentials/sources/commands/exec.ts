import {BaseCommand}            from '@yarnpkg/cli';
import {Configuration, Project} from '@yarnpkg/core';
import {execUtils, scriptUtils} from '@yarnpkg/core';
import {xfs}                    from '@yarnpkg/fslib';
import {Command, Usage}         from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class ExecCommand extends BaseCommand {
  @Command.String()
  commandName!: string;

  @Command.Proxy()
  args: Array<string> = [];

  static usage: Usage = Command.Usage({
    description: `execute a shell command`,
    details: `
      This command simply executes a shell binary within the context of the root directory of the active workspace.

      It also makes sure to call it in a way that's compatible with the current project (for example, on PnP projects the environment will be setup in such a way that PnP will be correctly injected into the environment).
    `,
    examples: [[
      `Execute a shell command`,
      `$0 exec echo Hello World`,
    ]],
  });

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
