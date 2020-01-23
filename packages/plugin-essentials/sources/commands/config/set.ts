import {BaseCommand}                from '@yarnpkg/cli';
import {Configuration}              from '@yarnpkg/core';
import {Command, Usage, UsageError} from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class ConfigSetCommand extends BaseCommand {
  @Command.String()
  name!: string;

  @Command.String()
  value!: string;

  static usage: Usage = Command.Usage({
    description: `change a configuration settings`,
  });

  @Command.Path(`config`, `set`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    if (!configuration.projectCwd)
      throw new UsageError(`This command must be run from within a project folder`);

    const setting = configuration.settings.get(this.name);
    if (typeof setting === `undefined`)
      throw new UsageError(`Couldn't find a configuration settings named "${this.name}"`);

    await Configuration.updateConfiguration(configuration.projectCwd, {
      [this.name]: this.value,
    });
  }
}
