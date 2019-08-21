import {BaseCommand}                                                    from '@berry/cli';
import {Configuration, MessageName, Project, ReportError, StreamReport} from '@berry/core';
import {httpUtils, structUtils}                                         from '@berry/core';
import {xfs, NodeFS, PortablePath, ppath}                               from '@berry/fslib';
import {Command}                                                        from 'clipanion';
import {runInNewContext}                                                from 'vm';

import {getAvailablePlugins}                                            from './list';

// eslint-disable-next-line arca/no-default-export
export default class PluginDlCommand extends BaseCommand {
  @Command.String()
  name!: string;

  static usage = Command.Usage({
    category: `Plugin-related commands`,
    description: `download a plugin`,
    details: `
      This command downloads the specified plugin from its remote location and updates the configuration to reference it in further CLI invocations.

      Three types of plugin references are accepted:

      - If the plugin is stored within the Yarn repository, it can be referenced by name.
      - Third-party plugins can be referenced directly through their public urls.
      - Local plugins can be referenced by their path on the disk.

      Plugins cannot be downloaded from the npm registry, and aren't allowed to have dependencies (they need to be bundled into a single file, possibly thanks to the \`@berry/builder\` package).
    `,
    examples: [[
      `Download and activate the "@berry/plugin-exec" plugin`,
      `yarn plugin import @berry/plugin-exec`,
    ], [
      `Download and activate a community plugin`,
      `yarn plugin import https://example.org/path/to/plugin.js`,
    ]],
  });

  @Command.Path(`plugin`, `import`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async report => {
      const {project} = await Project.find(configuration, this.context.cwd);

      const name = this.name!;
      const candidatePath = ppath.resolve(this.context.cwd, NodeFS.toPortablePath(name));

      let pluginBuffer;

      if (await xfs.existsPromise(candidatePath)) {
        report.reportInfo(MessageName.UNNAMED, `Reading ${configuration.format(candidatePath, `green`)}`);
        pluginBuffer = await xfs.readFilePromise(candidatePath);
      } else {
        const ident = structUtils.tryParseIdent(name);

        let pluginUrl;
        if (ident) {
          const key = structUtils.stringifyIdent(ident);
          const data = await getAvailablePlugins(configuration);

          if (!Object.prototype.hasOwnProperty.call(data, key))
            throw new ReportError(MessageName.PLUGIN_NAME_NOT_FOUND, `Couldn't find a plugin named "${key}" on the remote registry. Note that only the plugins referenced on our website (https://github.com/yarnpkg/berry/blob/master/plugins.yml) can be referenced by their name; any other plugin will have to be referenced through its public url (for example https://github.com/yarnpkg/berry/raw/master/packages/plugin-typescript/bin/%40berry/plugin-typescript.js).`);

          pluginUrl = data[key].url;
        } else {
          try {
            // @ts-ignore We don't want to add the dom to the TS env just for this line
            new URL(name);
          } catch {
            throw new ReportError(MessageName.INVALID_PLUGIN_REFERENCE, `Plugin specifier "${name}" is neither a plugin name nor a valid url`);
          }

          pluginUrl = name;
        }

        report.reportInfo(MessageName.UNNAMED, `Downloading ${configuration.format(pluginUrl, `green`)}`);
        pluginBuffer = await httpUtils.get(pluginUrl, {configuration});
      }

      const vmExports = {} as any;
      const vmModule = {exports: vmExports};

      runInNewContext(pluginBuffer.toString(), {
        module: vmModule,
        exports: vmExports,
      });

      const relativePath = `.yarn/plugins/${vmModule.exports.name}.js` as PortablePath;
      const absolutePath = ppath.resolve(project.cwd, relativePath);

      report.reportInfo(MessageName.UNNAMED, `Saving the new plugin in ${configuration.format(relativePath, `magenta`)}`);
      await xfs.mkdirpPromise(ppath.dirname(absolutePath));
      await xfs.writeFilePromise(absolutePath, pluginBuffer);

      await Configuration.updateConfiguration(project.cwd, (current: any) => ({
        plugins: (current.plugins || []).concat([
          relativePath,
        ]),
      }));
    });

    return report.exitCode();
  }
}
