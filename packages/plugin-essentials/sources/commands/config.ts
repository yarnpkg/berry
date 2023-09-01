import {BaseCommand}                                                      from '@yarnpkg/cli';
import {Configuration, MessageName, StreamReport, formatUtils, treeUtils} from '@yarnpkg/core';
import {Command, Option, Usage}                                           from 'clipanion';
import {inspect}                                                          from 'util';

// eslint-disable-next-line arca/no-default-export
export default class ConfigCommand extends BaseCommand {
  static paths = [
    [`config`],
  ];

  static usage: Usage = Command.Usage({
    description: `display the current configuration`,
    details: `
      This command prints the current active configuration settings.
    `,
    examples: [[
      `Print the active configuration settings`,
      `$0 config`,
    ]],
  });

  noDefaults = Option.Boolean(`--no-defaults`, false, {
    description: `Omit the default values from the display`,
  });

  verbose = Option.Boolean(`-v,--verbose`, false, {
    description: `Print the setting description on top of the regular key/value information`,
  });

  why = Option.Boolean(`--why`, false, {
    description: `Print the reason why a setting is set a particular way`,
  });

  json = Option.Boolean(`--json`, false, {
    description: `Format the output as an NDJSON stream`,
  });

  names = Option.Rest();

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins, {
      strict: false,
    });

    const names = this.names.length > 0
      ? [...new Set(this.names)].sort()
      : [...configuration.settings.keys()].sort();

    let trailingValue: any;

    const report = await StreamReport.start({
      configuration,
      json: this.json,
      stdout: this.context.stdout,
      includeFooter: false,
    }, async report => {
      if (configuration.invalid.size > 0 && !this.json) {
        for (const [key, source] of configuration.invalid)
          report.reportError(MessageName.INVALID_CONFIGURATION_KEY, `Invalid configuration key "${key}" in ${source}`);

        report.reportSeparator();
      }

      if (this.json) {
        for (const name of names) {
          const data = configuration.settings.get(name);
          if (typeof data === `undefined`)
            report.reportError(MessageName.INVALID_CONFIGURATION_KEY, `No configuration key named "${name}"`);

          report.reportSeparator();

          const effective = configuration.getSpecial(name, {
            hideSecrets: true,
            getNativePaths: true,
          });

          const source = configuration.sources.get(name);

          if (this.verbose) {
            report.reportJson({key: name, effective, source});
          } else {
            report.reportJson({key: name, effective, source, ...data});
          }
        }
      } else {
        const inspectConfig = {
          breakLength: Infinity,
          colors: configuration.get(`enableColors`),
          maxArrayLength: 2,
        };

        const configTreeChildren: treeUtils.TreeMap = {};
        const configTree: treeUtils.TreeNode = {children: configTreeChildren};

        for (const name of names) {
          if (this.noDefaults && !configuration.sources.has(name))
            continue;

          const setting = configuration.settings.get(name)!;
          const source = configuration.sources.get(name) ?? `<default>`;
          const value = configuration.getSpecial(name, {hideSecrets: true, getNativePaths: true});

          const fields: treeUtils.TreeMap = {
            Description: {
              label: `Description`,
              value: formatUtils.tuple(formatUtils.Type.MARKDOWN, {text: setting.description, format: this.cli.format(), paragraphs: false}),
            },
            Source: {
              label: `Source`,
              value: formatUtils.tuple(source[0] === `<` ? formatUtils.Type.CODE : formatUtils.Type.PATH, source),
            },
          };

          configTreeChildren[name] = {
            value: formatUtils.tuple(formatUtils.Type.CODE, name),
            children: fields,
          };

          const setValueTo = (node: treeUtils.TreeMap, value: Map<any, any>) => {
            for (const [key, subValue] of value) {
              if (subValue instanceof Map) {
                const subFields: treeUtils.TreeMap = {};
                node[key] = {children: subFields};
                setValueTo(subFields, subValue);
              } else {
                node[key] = {
                  label: key,
                  value: formatUtils.tuple(formatUtils.Type.NO_HINT, inspect(subValue, inspectConfig)),
                };
              }
            }
          };

          if (value instanceof Map) {
            setValueTo(fields, value);
          } else {
            fields.Value = {
              label: `Value`,
              value: formatUtils.tuple(formatUtils.Type.NO_HINT, inspect(value, inspectConfig)),
            };
          }
        }

        if (names.length !== 1)
          trailingValue = undefined;

        treeUtils.emitTree(configTree, {
          configuration,
          json: this.json,
          stdout: this.context.stdout,
          separators: 2,
        });
      }
    });

    if (!this.json && typeof trailingValue !== `undefined`) {
      const name = names[0];

      const value = inspect(configuration.getSpecial(name, {hideSecrets: true, getNativePaths: true}), {
        colors: configuration.get(`enableColors`),
      });

      this.context.stdout.write(`\n`);
      this.context.stdout.write(`${value}\n`);
    }

    return report.exitCode();
  }
}
