import {CommandContext, Configuration} from '@berry/core';
import {Command, UsageError}           from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class ConfigSetCommand extends Command<CommandContext> {
  @Command.String()
  name!: string;

  @Command.String()
  value!: string;

  static usage = Command.Usage({
    description: `change a configuration settings`,
  });

  @Command.Path(`config`, `set`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    if (!configuration.projectCwd)
      throw new UsageError(`This command must be run from within a project folder`);

    const settings = configuration.settings.get(this.name);
    if (!settings)
      throw new UsageError(`Couldn't find a configuration settings named "${this.name}"`);

    await Configuration.updateConfiguration(configuration.projectCwd, {
      [this.name]: this.value,
    });
  }
}
