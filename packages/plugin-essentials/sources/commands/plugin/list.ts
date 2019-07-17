import {CommandContext, Configuration, StreamReport}                                   from '@berry/core';
import {Command}                                                                       from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class PluginListCommand extends Command<CommandContext> {
  static usage = Command.Usage({
    description: `list the active plugins`,
    details: `
      This command prints the currently active plugins. Will be displayed both builtin plugins and external plugins.
    `,
    examples: [[
      `List the currently active plugins`,
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
      for (const name of configuration.plugins.keys()) {
        if (this.context.plugins.plugins.has(name)) {
          report.reportInfo(null, `${name} [builtin]`);
        } else {
          report.reportInfo(null, `${name}`);
        }
      }
    });

    return report.exitCode();
  }
}
