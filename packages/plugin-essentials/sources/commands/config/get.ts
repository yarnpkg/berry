import {BaseCommand}                from '@yarnpkg/cli';
import {Configuration}              from '@yarnpkg/core';
import {stringifySyml}              from '@yarnpkg/parsers';
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

    const value = convertMapsToObjects(configuration.get(this.name));

    this.context.stdout.write(`${stringifySyml(value)}\n`);
  }
}

/**
 * Converts `Maps` to `Objects` recursively.
 */
function convertMapsToObjects(arg: unknown) {
  if (arg instanceof Map)
    arg = Object.fromEntries(arg);
  if (typeof arg === 'object' && arg !== null) {
    for (const key of Object.keys(arg)) {
      let value = arg[key as keyof object] as unknown;
      if (typeof value === 'object' && value !== null) {
        (arg[key as keyof object] as unknown) = convertMapsToObjects(value);
      }
    }
  }
  return arg;
};
