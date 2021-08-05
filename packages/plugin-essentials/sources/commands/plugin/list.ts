import {BaseCommand}                              from '@yarnpkg/cli';
import {Configuration, StreamReport, YarnVersion} from '@yarnpkg/core';
import {Command, Option, Usage}                   from 'clipanion';

import * as repoUtils                             from '../../repoUtils';

// eslint-disable-next-line arca/no-default-export
export default class PluginDlCommand extends BaseCommand {
  static paths = [
    [`plugin`, `list`],
  ];

  static usage: Usage = Command.Usage({
    category: `Plugin-related commands`,
    description: `list the available official plugins`,
    details: `
      This command prints the plugins available directly from the Yarn repository. Only those plugins can be referenced by name in \`yarn plugin import\`.
    `,
    examples: [[
      `List the official plugins`,
      `$0 plugin list`,
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
      const data = await repoUtils.getAvailablePlugins(configuration, YarnVersion ?? repoUtils.Latest.STABLE);

      for (const [name, {experimental, ...rest}] of Object.entries(data)) {
        let label = name;

        if (experimental)
          label += ` [experimental]`;

        report.reportJson({name, experimental, ...rest});
        report.reportInfo(null, label);
      }
    });

    return report.exitCode();
  }
}
