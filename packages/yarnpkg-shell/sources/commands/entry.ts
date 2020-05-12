import {npath}          from '@yarnpkg/fslib';
import {Command, Usage} from 'clipanion';

import {execute}        from '../index';

// eslint-disable-next-line arca/no-default-export
export default class EntryCommand extends Command {
  @Command.String()
  commandName!: string;

  @Command.Proxy()
  args: Array<string> = [];

  @Command.String(`--cwd`)
  cwd: string = process.cwd();

  static usage: Usage = {
    description: `run a command using yarn's portable shell`,
    details: `
      This command will run a command using Yarn's portable shell.

      Make sure to escape glob patterns, redirections, and other features that might be expanded by your own shell.

      Note: To escape something from Yarn's shell, you might have to escape it twice, the first time from your own shell.

      Note: Don't use this command in Yarn scripts, as Yarn's shell is automatically used.

      For a list of features, visit: https://github.com/yarnpkg/berry/blob/master/packages/yarnpkg-shell/README.md.
    `,
    examples: [[
      `Run a simple command`,
      `$0 echo Hello`,
    ], [
      `Run a command with a glob pattern`,
      `$0 echo '*.js'`,
    ], [
      `Run a command with a redirection`,
      `$0 echo Hello World '>' hello.txt`,
    ], [
      `Run a command with an escaped glob pattern (The double escape is needed in Unix shells)`,
      `$0 echo '"*.js"'`,
    ], [
      `Run a command with a variable (Double quotes are needed in Unix shells, to prevent them from expanding the variable)`,
      `$0 "GREETING=Hello echo $GREETING World"`,
    ]],
  };

  async execute() {
    // We assume that all arguments have to be processed by our shell,
    // not by the user's shell
    const command = this.args.length > 0
      ? `${this.commandName} ${this.args.join(` `)}`
      : this.commandName;

    return await execute(command, [], {
      cwd: npath.toPortablePath(this.cwd),
      stdin: this.context.stdin,
      stdout: this.context.stdout,
      stderr: this.context.stderr,
    });
  }
}
