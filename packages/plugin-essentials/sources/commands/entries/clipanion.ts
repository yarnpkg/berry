import {CommandContext} from '@berry/core';
import {Command}        from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class ClipanionCommand extends Command<CommandContext> {
  @Command.Path(`--clipanion=definitions`)
  async execute() {
    this.context.stdout.write(`${JSON.stringify({
      commands: this.cli.definitions(),
    }, null, 2)}\n`);
  }
}
