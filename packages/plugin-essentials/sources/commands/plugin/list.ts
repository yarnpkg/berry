import {BaseCommand}                                                      from '@yarnpkg/cli';
import {Configuration, StreamReport, httpUtils, semverUtils, YarnVersion} from '@yarnpkg/core';
import {parseSyml}                                                        from '@yarnpkg/parsers';
import {Command, Option, Usage}                                           from 'clipanion';

const REMOTE_REGISTRY = `https://raw.githubusercontent.com/yarnpkg/berry/master/plugins.yml`;

export async function getAvailablePlugins(configuration: Configuration, version: string | null) {
  const raw = await httpUtils.get(REMOTE_REGISTRY, {configuration});
  const data = parseSyml(raw.toString());

  return Object.fromEntries(Object.entries(data).filter(([pluginName, pluginData]) => {
    return !version || semverUtils.satisfiesWithPrereleases(version, pluginData.range ?? `<4.0.0`);
  }));
}

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
      const data = await getAvailablePlugins(configuration, YarnVersion);

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
