import {CommandContext} from '@berry/core';
import {NodeFS, ppath}  from '@berry/fslib';
import {Command}        from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class EntryCommand extends Command<CommandContext> {
  @Command.Proxy()
  args: Array<string> = [];

  async execute() {
    // berry --version
    if (this.args.length === 1 && (this.args[0] === `--version` || this.args[0] === `-v`)) {
      // Injected via webpack DefinePlugin
      this.context.stdout.write(`v${BERRY_VERSION}\n`);

    // berry --frozen-lockfile
    } else if (this.args.length === 0 || this.args[0].charAt(0) === `-`) {
      return await this.cli.run([`install`, ...this.args]);

    // berry ~/projects/foo install
    } else if (this.args.length !== 0 && this.args[0].match(/[\\\/]/)) {
      const newCwd = ppath.resolve(this.context.cwd, NodeFS.toPortablePath(this.args[0]));
      return await this.cli.run(this.args.slice(1), {cwd: newCwd});

    // berry start
    } else {
      return await this.cli.run([`run`, ...this.args]);
    }
  }
}
