import {BaseCommand}                                                                 from '@yarnpkg/cli';
import {Configuration, formatUtils, hashUtils, httpUtils, MessageName, StreamReport} from '@yarnpkg/core';
import {Command, Option, Usage}                                                      from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class PluginCheckCommand extends BaseCommand {
  static paths = [
    [`plugin`, `check`],
  ];

  static usage: Usage = Command.Usage({
    category: `Plugin-related commands`,
    description: `find all third-party plugins that differ from their own spec`,
    details: `
      Check only the plugins from https.

      If this command detects any plugin differences in the CI environment, it will throw an error.
    `,
    examples: [[
      `find all third-party plugins that differ from their own spec`,
      `$0 plugin check`,
    ]],
  });

  json = Option.Boolean(`--json`, false, {
    description: `Format the output as an NDJSON stream`,
  });

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const rcFiles = await Configuration.findRcFiles(this.context.cwd);

    const report = await StreamReport.start({
      configuration,
      json: this.json,
      stdout: this.context.stdout,
    }, async report => {
      for (const rcFile of rcFiles) {
        if (!rcFile.data?.plugins) continue;

        for (const plugin of rcFile.data.plugins) {
          if (!plugin.checksum)
            continue;
          if (!plugin.spec.match(/^https?:/))
            continue;

          const newBuffer = await httpUtils.get(plugin.spec, {configuration});
          const newChecksum = hashUtils.makeHash(newBuffer);
          if (plugin.checksum === newChecksum)
            continue;

          const prettyPath = formatUtils.pretty(configuration, plugin.path, formatUtils.Type.PATH) ;
          const prettySpec = formatUtils.pretty(configuration, plugin.spec, formatUtils.Type.URL) ;
          const prettyMessage =  `${prettyPath} is different from the file provided by ${prettySpec}`;

          report.reportJson({...plugin, newChecksum});
          report.reportError(MessageName.UNNAMED, prettyMessage);
        }
      }
    });

    return report.exitCode();
  }
}
