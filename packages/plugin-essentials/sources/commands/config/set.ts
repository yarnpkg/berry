import {BaseCommand}                from '@yarnpkg/cli';
import {Configuration}              from '@yarnpkg/core';
import {parseSyml}                  from '@yarnpkg/parsers';
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

    let parsedValue;
    try {
      parsedValue = parseSyml(`${this.name}: ${this.value}`)[this.name];
    } catch {
      // Use invalid YAML values as strings
      // This allows the use of unquoted strings that would need quotes at the top-level
      // For example: `yarn config set someOption @unquoted-value`
      parsedValue = this.value;
    }

    await Configuration.updateConfiguration(configuration.projectCwd, {
      [this.name]: parsedValue,
    });
  }
}
