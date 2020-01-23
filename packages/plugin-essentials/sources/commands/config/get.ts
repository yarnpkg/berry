import {BaseCommand}                from '@yarnpkg/cli';
import {Configuration}              from '@yarnpkg/core';
import {Command, Usage, UsageError} from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class ConfigSetCommand extends BaseCommand {
  @Command.String()
  name!: string;

  static usage: Usage = Command.Usage({
    description: `read a configuration settings`,
  });

  @Command.Path(`config`, `get`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);

    const setting = configuration.settings.get(this.name);
    if (typeof setting === `undefined`)
      throw new UsageError(`Couldn't find a configuration settings named "${this.name}"`);

    this.context.stdout.write(`${configuration.get(this.name)}\n`);
  }
}
