import {BaseCommand}                              from '@yarnpkg/cli';
import {Configuration, StreamReport, MessageName} from '@yarnpkg/core';
import {Command, Usage, UsageError}               from 'clipanion';
import {inspect}                                  from 'util';

// eslint-disable-next-line arca/no-default-export
export default class ConfigSetCommand extends BaseCommand {
  @Command.String()
  name!: string;

  @Command.String()
  value!: string;

  @Command.Boolean(`--json`)
  json: boolean = false;

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

    const report = await StreamReport.start({
      configuration,
      includeFooter: false,
      stdout: this.context.stdout,
    }, async report => {
      const value: unknown = this.json ? tryParseJson(this.name, this.value, report) : this.value;

      await Configuration.updateConfiguration(configuration.projectCwd!, {
        [this.name]: value,
      });

      // @ts-ignore: The Node typings forgot one field
      inspect.styles.name = `cyan`;

      report.reportInfo(MessageName.UNNAMED, `Successfully set ${this.name} to:\n${inspect(value, {
        depth: Infinity,
        colors: true,
        compact: false,
      })}`);
    });

    return report.exitCode();
  }
}

function tryParseJson(name: string, value: string, report: StreamReport): unknown {
  try {
    return JSON.parse((`{ "${name}": ${value} }`))[name];
  } catch (error) {
    try {
      report.reportWarning(MessageName.UNNAMED, `The entered value isn't a valid complex JSON value. It will be parsed as a string.`);
      return JSON.parse((`{ "${name}": "${value}" }`))[name];
    } catch {
      throw new UsageError(error);
    }
  }
};
