import {Command} from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class VersionCommand extends Command {
  @Command.Path(`--version`)
  @Command.Path(`-v`)
  async execute() {
    this.context.stdout.write(`${require(`@yarnpkg/shell/package.json`).version || `<unknown>`}\n`);
  }
}
