import {BaseCommand}            from '@yarnpkg/cli';
import {Configuration, Project} from '@yarnpkg/core';
import {scriptUtils}            from '@yarnpkg/core';
import {Command, Option, Usage} from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class ExecCommand extends BaseCommand {
  static paths = [
    [`exec`],
  ];

  static usage: Usage = Command.Usage({
    description: `execute a shell script`,
    details: `
      This command simply executes a shell script within the context of the root directory of the active workspace using the portable shell.

      It also makes sure to call it in a way that's compatible with the current project (for example, on PnP projects the environment will be setup in such a way that PnP will be correctly injected into the environment).
    `,
    examples: [[
      `Execute a single shell command`,
      `$0 exec echo Hello World`,
    ], [
      `Execute a shell script`,
      `$0 exec "tsc & babel src --out-dir lib"`,
    ]],
  });

  commandName = Option.String();
  args = Option.Proxy();

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, locator} = await Project.find(configuration, this.context.cwd);

    await project.restoreInstallState();

    return await scriptUtils.executePackageShellcode(locator, this.commandName, this.args, {
      cwd: this.context.cwd,
      stdin: this.context.stdin,
      stdout: this.context.stdout,
      stderr: this.context.stderr,
      project,
    });
  }
}
