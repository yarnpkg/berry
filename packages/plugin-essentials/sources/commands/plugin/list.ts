import {BaseCommand}                            from '@yarnpkg/cli';
import {Configuration, StreamReport, httpUtils} from '@yarnpkg/core';
import {parseSyml}                              from '@yarnpkg/parsers';
import {Command}                                from 'clipanion';

const REMOTE_REGISTRY = `https://raw.githubusercontent.com/yarnpkg/berry/master/plugins.yml`;

export async function getAvailablePlugins(configuration: Configuration) {
  const raw = await httpUtils.get(REMOTE_REGISTRY, {configuration});
  const data = parseSyml(raw.toString());

  return data;
}

// eslint-disable-next-line arca/no-default-export
export default class PluginDlCommand extends BaseCommand {
  static usage = Command.Usage({
    category: `Plugin-related commands`,
    description: `list the available official plugins`,
    details: `
      This command prints the plugins available directly from the Yarn repository. Only those plugins can be referenced by name in \`yarn plugin import\`.
    `,
    examples: [[
      `List the official plugins`,
      `yarn plugin list`,
    ]],
  });

  @Command.Path(`plugin`, `list`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async report => {
      const data = await getAvailablePlugins(configuration);

      for (const [name, {experimental}] of Object.entries(data)) {
        let label = name;

        if (experimental)
          label += ` [experimental]`;

        report.reportInfo(null, label);
      }
    });

    return report.exitCode();
  }
}
