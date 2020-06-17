import {BaseCommand}                                                                   from '@yarnpkg/cli';
import {Configuration,  MessageName,  Project,  StreamReport, FormatType, structUtils} from '@yarnpkg/core';
import {PortablePath, ppath, xfs}                                                      from '@yarnpkg/fslib';
import {Command, Usage, UsageError}                                                    from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class PluginRemoveCommand extends BaseCommand {
  @Command.String()
  name!: string;

  static usage: Usage = Command.Usage({
    category: `Plugin-related commands`,
    description: `remove a plugin`,
    details: `
      This command deletes the specified plugin from the .yarn/plugins folder and removes it from the configuration.

      **Note:** The plugins have to be referenced by their name property, which can be obtained using the \`yarn plugin runtime\` command. Shorthands are not allowed.
   `,
    examples: [[
      `Remove a plugin imported from the Yarn repository`,
      `$0 plugin remove @yarnpkg/plugin-typescript`,
    ], [
      `Remove a plugin imported from a local file`,
      `$0 plugin remove my-local-plugin`,
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
      const pluginIdent = structUtils.parseIdent(pluginName);

      if (!configuration.plugins.has(pluginName))
        throw new UsageError(`${structUtils.prettyIdent(configuration, pluginIdent)} isn't referenced by the current configuration`);

      const relativePath = `.yarn/plugins/${pluginName}.cjs` as PortablePath;
      const absolutePath = ppath.resolve(project.cwd, relativePath);

      if (xfs.existsSync(absolutePath)) {
        report.reportInfo(MessageName.UNNAMED, `Removing ${configuration.format(relativePath, FormatType.PATH)}...`);
        await xfs.removePromise(absolutePath);
      }

      report.reportInfo(MessageName.UNNAMED, `Updating the configuration...`);
      await Configuration.updateConfiguration(project.cwd, (current: any) => {
        if (!Array.isArray(current.plugins))
          return {};

        const plugins = current.plugins.filter((plugin: {path: string}) => plugin.path !== relativePath);
        return {plugins};
      });
    });

    return report.exitCode();
  }
}
