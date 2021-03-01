import {BaseCommand}                 from '@yarnpkg/cli';
import {Configuration, StreamReport} from '@yarnpkg/core';
import {Command, Option, Usage}      from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class PluginListCommand extends BaseCommand {
  static paths = [
    [`plugin`, `runtime`],
  ];

  static usage: Usage = Command.Usage({
    category: `Plugin-related commands`,
    description: `list the active plugins`,
    details: `
      This command prints the currently active plugins. Will be displayed both builtin plugins and external plugins.
    `,
    examples: [[
      `List the currently active plugins`,
      `$0 plugin runtime`,
    ]],
  });

  json = Option.Boolean(`--json`, false, {
    description: `Format the output as an NDJSON stream`,
  });

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);

    const report = await StreamReport.start({
      configuration,
      json: this.json,
      stdout: this.context.stdout,
    }, async report => {
      for (const name of configuration.plugins.keys()) {
        const builtin  = this.context.plugins.plugins.has(name);
        let label = name;

        if (builtin)
          label += ` [builtin]`;

        report.reportJson({name, builtin});
        report.reportInfo(null, `${label}`);
      }
    });

    return report.exitCode();
  }
}
