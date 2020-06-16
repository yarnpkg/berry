import {BaseCommand}                                          from '@yarnpkg/cli';
import {Configuration,  MessageName,  Project,  StreamReport} from '@yarnpkg/core';
import {PortablePath, ppath, xfs}                             from '@yarnpkg/fslib';
import {Command, Usage}                                       from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class PluginRemoveCommand extends BaseCommand {
  @Command.String()
  name!: string;

  static usage: Usage = Command.Usage({
    category: `Plugin-related commands`,
    description: `remove a plugin`,
    details: `
      This command removes the specified plugin from the configuration and wont be able to reference it again untill you have installed the plugin.

      <name> - The plugin name that was specified in the plugin name property.

      NOTE: short hands are not allowed and wont be detected.
   `,
    examples: [[
      `Remove a plugin which was created using the shorthand notation or package name`,
      `$0 plugin remove @yarnpkg/plugin-typescript`,
    ],[
      `Remove a plugin which was created locally`,
      `$0 plugin remove pluginName`,
    ]],
  });

  @Command.Path(`plugin`, `remove`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project} = await Project.find(configuration, this.context.cwd);

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async report => {
      const pluginName = this.name;

      const relativePath = `.yarn/plugins/${pluginName}.js` as PortablePath;
      const absolutePath = ppath.resolve(project.cwd, relativePath);

      report.reportInfo(MessageName.UNNAMED, `Removing the plugin ${configuration.format(relativePath, `magenta`)}`);

      await xfs.removePromise(absolutePath);

      const pluginMeta = {
        path: relativePath,
        spec: pluginName,
      };

      await Configuration.updateConfiguration(project.cwd, (current: any) => {
        const plugins = current.plugins.filter((x: {path: string, spec: string}) => x.path !== pluginMeta.path );
        return {plugins};
      });
    });

    return report.exitCode();
  }
}
