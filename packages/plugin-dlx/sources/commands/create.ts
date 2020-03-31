import {BaseCommand} from '@yarnpkg/cli';
import {Command}     from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class CreateCommand extends BaseCommand {
  @Command.String(`-p,--package`)
  pkg: string | undefined;

  @Command.Boolean(`-q,--quiet`)
  quiet: boolean = false;

  @Command.String()
  command!: string;

  @Command.Proxy()
  args: Array<string> = [];

  @Command.Path(`create`)
  async execute() {
    const flags = [];
    if (this.pkg)
      flags.push(`--package`, this.pkg);
    if (this.quiet)
      flags.push('--quiet');
    this.cli.run([`dlx`, ...flags, `create-${this.command}`, ...this.args]);
  }
}
