import {BaseCommand}                              from '@yarnpkg/cli';
import {Configuration, MessageName, StreamReport} from '@yarnpkg/core';
import {miscUtils}                                from '@yarnpkg/core';
import {Command, Usage}                           from 'clipanion';
import {inspect}                                  from 'util';

// eslint-disable-next-line arca/no-default-export
export default class ConfigCommand extends BaseCommand {
  @Command.Boolean(`-v,--verbose`)
  verbose: boolean = false;

  @Command.Boolean(`--why`)
  why: boolean = false;

  @Command.Boolean(`--json`)
  json: boolean = false;

  static usage: Usage = Command.Usage({
    description: `display the current configuration`,
    details: `
      This command prints the current active configuration settings.

      When used together with the \`-v,--verbose\` option, the output will contain the settings description on top of the regular key/value information.

      When used together with the \`--why\` flag, the output will also contain the reason why a settings is set a particular way.

      If the \`--json\` flag is set the output will follow a JSON-stream output also known as NDJSON (https://github.com/ndjson/ndjson-spec).

      Note that the paths settings will be normalized - especially on Windows. It means that paths such as \`C:\\project\` will be transparently shown as \`/mnt/c/project\`.
    `,
    examples: [[
      `Print the active configuration settings`,
      `$0 config`,
    ]],
  });

  @Command.Path(`config`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins, {
      strict: false,
    });

    const report = await StreamReport.start({
      configuration,
      json: this.json,
      stdout: this.context.stdout,
    }, async report => {
      if (configuration.invalid.size > 0 && !this.json) {
        for (const [key, source] of configuration.invalid)
          report.reportError(MessageName.INVALID_CONFIGURATION_KEY, `Invalid configuration key "${key}" in ${source}`);

        report.reportSeparator();
      }

      if (this.json) {
        const keys = miscUtils.sortMap(configuration.settings.keys(), key => key);

        for (const key of keys) {
          const data = configuration.settings.get(key);

          const effective = configuration.getSpecial(key, {
            hideSecrets: true,
            getNativePaths: true,
          });

          const source = configuration.sources.get(key);

          if (this.verbose) {
            report.reportJson({key, effective, source});
          } else {
            report.reportJson({key, effective, source, ...data});
          }
        }
      } else {
        const keys = miscUtils.sortMap(configuration.settings.keys(), key => key);
        const maxKeyLength = keys.reduce((max, key) => Math.max(max, key.length), 0);

        const inspectConfig = {
          breakLength: Infinity,
          colors: configuration.get(`enableColors`),
          maxArrayLength: 2,
        };

        if (this.why || this.verbose) {
          const keysAndDescriptions = keys.map(key => {
            const setting = configuration.settings.get(key);

            if (!setting)
              throw new Error(`Assertion failed: This settings ("${key}") should have been registered`);

            const description = this.why
              ? configuration.sources.get(key) || `<default>`
              : setting.description;

            return [key, description] as [string, string];
          });

          const maxDescriptionLength = keysAndDescriptions.reduce((max, [, description]) => {
            return Math.max(max, description.length);
          }, 0);

          for (const [key, description] of keysAndDescriptions) {
            report.reportInfo(null, `${key.padEnd(maxKeyLength, ` `)}   ${description.padEnd(maxDescriptionLength, ` `)}   ${inspect(configuration.getSpecial(key, {hideSecrets: true, getNativePaths: true}), inspectConfig)}`);
          }
        } else {
          for (const key of keys) {
            report.reportInfo(null, `${key.padEnd(maxKeyLength, ` `)}   ${inspect(configuration.getSpecial(key, {hideSecrets: true, getNativePaths: true}), inspectConfig)}`);
          }
        }
      }
    });

    return report.exitCode();
  }
}
