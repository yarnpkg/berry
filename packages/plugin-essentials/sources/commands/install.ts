import {CommandContext} from '@berry/core';
import {NodeFS, ppath}  from '@berry/fslib';
import {Command}        from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class InstallCommand extends Command<CommandContext> {
  @Command.Proxy()
  args: Array<string> = [];

  @Command.Path(`install`)
  async execute() {
    return await this.cli.run([`yarn`, ...this.args]);
  }
}
