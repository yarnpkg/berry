import {BaseCommand}                 from '@yarnpkg/cli';
import {Configuration, StreamReport} from '@yarnpkg/core';
import {Command, Usage, UsageError}  from 'clipanion';
import {inspect}                     from 'util';

// eslint-disable-next-line arca/no-default-export
export default class ConfigSetCommand extends BaseCommand {
  @Command.String()
  name!: string;

  @Command.Boolean(`--json`)
  json: boolean = false;

  static usage: Usage = Command.Usage({
    description: `read a configuration settings`,
    details: `
      This command will print a configuration setting.
    `,
    examples: [[
      `Print a simple configuration setting`,
      `yarn config get yarnPath`,
    ], [
      `Print a complex configuration setting`,
      `yarn config get packageExtensions`,
    ], [
      `Print a configuration setting as JSON`,
      `yarn config get packageExtensions --json`,
    ]],
  });

  @Command.Path(`config`, `get`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);

    const setting = configuration.settings.get(this.name);
    if (typeof setting === `undefined`)
      throw new UsageError(`Couldn't find a configuration settings named "${this.name}"`);

    const value = configuration.get(this.name);

    const report = await StreamReport.start({
      configuration,
      includeFooter: false,
      json: this.json,
      stdout: this.context.stdout,
    }, async report => {
      report.reportJson(convertMapsToObjects(value));
    });

    if (!this.json) {
      if (typeof value === `string`) {
        this.context.stdout.write(`${value}\n`);
        return report.exitCode();
      }

      // @ts-ignore: The Node typings forgot one field
      inspect.styles.name = `cyan`;

      this.context.stdout.write(`${inspect(value, {
        depth: Infinity,
        colors: true,
        compact: false,
      })}\n`);
    }

    return report.exitCode();
  }
}

/**
 * Converts `Maps` to `Objects` recursively.
 */
function convertMapsToObjects(arg: unknown): unknown {
  if (arg instanceof Map)
    arg = Object.fromEntries(arg);
  if (typeof arg === 'object' && arg !== null) {
    for (const key of Object.keys(arg)) {
      const value = arg[key as keyof object] as unknown;
      if (typeof value === 'object' && value !== null) {
        (arg[key as keyof object] as unknown) = convertMapsToObjects(value);
      }
    }
  }
  return arg;
};
