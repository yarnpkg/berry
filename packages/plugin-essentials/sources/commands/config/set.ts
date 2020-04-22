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
    details: `
      This command will set a configuration setting.

      When used without the \`--json\` flag, it can only set a simple configuration setting (a string, a number, or a boolean).

      When used with the \`--json\` flag, it can set both simple and complex configuration settings, including Arrays and Objects.
    `,
    examples: [[
      `Set a simple configuration setting (a string, a number, or a boolean)`,
      `yarn config set initScope myScope`,
    ], [
      `Set a simple configuration setting (a string, a number, or a boolean) using the \`--json\` flag`,
      `yarn config set initScope --json \\"myScope\\"`,
    ], [
      `Set a complex configuration setting (an Array) using the \`--json\` flag`,
      `yarn config set unsafeHttpWhitelist --json '["*.example.com", "example.com"]'`,
    ], [
      `Set a complex configuration setting (an Object) using the \`--json\` flag`,
      `yarn config set packageExtensions --json '{ "@babel/parser@*": { "dependencies": { "@babel/types": "*" } } }'`,
    ]],
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
      const value: unknown = this.json ? JSON.parse(this.value) : this.value;

      await Configuration.updateConfiguration(configuration.projectCwd!, {
        [this.name]: value,
      });

      const updatedConfiguration = await Configuration.find(this.context.cwd, this.context.plugins);

      // @ts-ignore: The Node typings forgot one field
      inspect.styles.name = `cyan`;

      report.reportInfo(MessageName.UNNAMED, `Successfully set ${this.name} to:\n${inspect(updatedConfiguration.getForDisplay(this.name), {
        depth: Infinity,
        colors: true,
        compact: false,
      })}`);
    });

    return report.exitCode();
  }
}
