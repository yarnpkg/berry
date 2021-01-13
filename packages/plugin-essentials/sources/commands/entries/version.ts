import {CommandContext, YarnVersion} from '@yarnpkg/core';
import {Command}                     from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class VersionCommand extends Command<CommandContext> {
  static paths = [
    [`-v`],
    [`--version`],
  ];

  async execute() {
    this.context.stdout.write(`${YarnVersion || `<unknown>`}\n`);
  }
}
