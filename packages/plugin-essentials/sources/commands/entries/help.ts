import {CommandContext} from '@yarnpkg/core';
import {Command}        from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class HelpCommand extends Command<CommandContext> {
  static paths = [
    [`help`],
    [`--help`],
    [`-h`],
  ];

  async execute() {
    this.context.stdout.write(this.cli.usage(null));
  }
}
