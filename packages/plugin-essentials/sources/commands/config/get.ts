import {BaseCommand}                            from '@yarnpkg/cli';
import {Configuration, StreamReport, miscUtils} from '@yarnpkg/core';
import {Command, Option, Usage, UsageError}     from 'clipanion';
import getPath                                  from 'lodash/get';
import {inspect}                                from 'util';

// eslint-disable-next-line arca/no-default-export
export default class ConfigGetCommand extends BaseCommand {
  static paths = [
    [`config`, `get`],
  ];

  static usage: Usage = Command.Usage({
    description: `read a configuration settings`,
    details: `
      This command will print a configuration setting.

      Secrets (such as tokens) will be redacted from the output by default. If this behavior isn't desired, set the \`--no-redacted\` to get the untransformed value.
    `,
    examples: [[
      `Print a simple configuration setting`,
      `yarn config get yarnPath`,
    ], [
      `Print a complex configuration setting`,
      `yarn config get packageExtensions`,
    ], [
      `Print a nested field from the configuration`,
      `yarn config get 'npmScopes["my-company"].npmRegistryServer'`,
    ], [
      `Print a token from the configuration`,
      `yarn config get npmAuthToken --no-redacted`,
    ], [
      `Print a configuration setting as JSON`,
      `yarn config get packageExtensions --json`,
    ]],
  });

  json = Option.Boolean(`--json`, false, {
    description: `Format the output as an NDJSON stream`,
  });

  unsafe = Option.Boolean(`--no-redacted`, false, {
    description: `Don't redact secrets (such as tokens) from the output`,
  });

  name = Option.String();

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);

    const name = this.name.replace(/[.[].*$/, ``);
    const path = this.name.replace(/^[^.[]*/, ``);

    const setting = configuration.settings.get(name);
    if (typeof setting === `undefined`)
      throw new UsageError(`Couldn't find a configuration settings named "${name}"`);

    const displayedValue = configuration.getSpecial(name, {
      hideSecrets: !this.unsafe,
      getNativePaths: true,
    });

    const asObject = miscUtils.convertMapsToIndexableObjects(displayedValue);
    const requestedObject = path
      ? getPath(asObject, path)
      : asObject;

    const report = await StreamReport.start({
      configuration,
      includeFooter: false,
      json: this.json,
      stdout: this.context.stdout,
    }, async report => {
      report.reportJson(requestedObject);
    });

    if (!this.json) {
      if (typeof requestedObject === `string`) {
        this.context.stdout.write(`${requestedObject}\n`);
        return report.exitCode();
      }

      // @ts-expect-error: The Node typings forgot one field
      inspect.styles.name = `cyan`;

      this.context.stdout.write(`${inspect(requestedObject, {
        depth: Infinity,
        colors: configuration.get(`enableColors`),
        compact: false,
      })}\n`);
    }

    return report.exitCode();
  }
}
