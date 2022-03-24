import {BaseCommand} from '@yarnpkg/cli';
import {YarnVersion} from '@yarnpkg/core';

// eslint-disable-next-line arca/no-default-export
export default class VersionCommand extends BaseCommand {
  static paths = [
    [`-v`],
    [`--version`],
  ];

  async execute() {
    this.context.stdout.write(`${YarnVersion || `<unknown>`}\n`);
  }
}
