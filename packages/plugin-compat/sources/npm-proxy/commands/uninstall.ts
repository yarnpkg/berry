import {BaseCommand} from '@yarnpkg/cli';
import {Command}     from 'clipanion';

export class UninstallCommand extends BaseCommand {
  @Command.Rest()
  packages: Array<string> = [];

  // Ignored default
  @Command.Boolean(`--save`)
  save!: boolean;

  @Command.Path(`npm`, `uninstall`)
  execute() {
    return this.cli.run([`remove`, ...this.packages]);
  }
}
