import {BaseCommand} from '@yarnpkg/cli';

// eslint-disable-next-line arca/no-default-export
export default class HelpCommand extends BaseCommand {
  static paths = [
    [`help`],
    [`--help`],
    [`-h`],
  ];

  async execute() {
    this.context.stdout.write(this.cli.usage(null));
  }
}
