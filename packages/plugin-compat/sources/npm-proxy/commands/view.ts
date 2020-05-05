import {BaseCommand} from '@yarnpkg/cli';
import {Command}     from 'clipanion';

export class ViewCommand extends BaseCommand {
  @Command.Boolean(`--json`)
  json!: boolean;

  @Command.String()
  package!: string;

  @Command.Path(`npm`, `view`)
  execute() {
    return this.cli.run([`npm`, `info`, this.package, this.json && `--json`].filter(x => x) as Array<string>);
  }
}
