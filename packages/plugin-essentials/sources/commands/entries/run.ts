import {CommandContext, structUtils} from '@yarnpkg/core';
import {npath, ppath}                from '@yarnpkg/fslib';
import {Command}                     from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class EntryCommand extends Command<CommandContext> {
  @Command.String()
  leadingArgument!: string;

  @Command.Proxy()
  args: Array<string> = [];

  async execute() {
    if (this.leadingArgument.match(/[\\/]/) && !structUtils.tryParseIdent(this.leadingArgument)) {
      const newCwd = ppath.resolve(this.context.cwd, npath.toPortablePath(this.leadingArgument));
      return await this.cli.run(this.args, {cwd: newCwd});
    } else {
      return await this.cli.run([`run`, this.leadingArgument, ...this.args]);
    }
  }
}
