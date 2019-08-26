import {Command} from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class HelpCommand extends Command {
  @Command.Path(`--help`)
  @Command.Path(`-h`)
  async execute() {
    this.context.stdout.write(this.cli.usage(null));
  }
}
