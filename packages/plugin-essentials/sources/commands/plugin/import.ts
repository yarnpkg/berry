import {BaseCommand}                                                                       from '@yarnpkg/cli';
import {Configuration, MessageName, Project, ReportError, StreamReport, miscUtils, Report} from '@yarnpkg/core';
import {httpUtils, structUtils}                                                            from '@yarnpkg/core';
import {PortablePath, npath, ppath, xfs}                                                   from '@yarnpkg/fslib';
import {Command, Usage}                                                                    from 'clipanion';
import {runInNewContext}                                                                   from 'vm';

import {getAvailablePlugins}                                                               from './list';

// eslint-disable-next-line arca/no-default-export
export default class PluginDlCommand extends BaseCommand {
  @Command.String()
  name!: string;

  static usage: Usage = Command.Usage({
    category: `Plugin-related commands`,
    description: `download a plugin`,
    details: `
      This command downloads the specified plugin from its remote location and updates the configuration to reference it in further CLI invocations.

      Three types of plugin references are accepted:

      - If the plugin is stored within the Yarn repository, it can be referenced by name.
      - Third-party plugins can be referenced directly through their public urls.
      - Local plugins can be referenced by their path on the disk.

      Plugins cannot be downloaded from the npm registry, and aren't allowed to have dependencies (they need to be bundled into a single file, possibly thanks to the \`@yarnpkg/builder\` package).
    `,
    examples: [[
      `Download and activate the "@yarnpkg/plugin-exec" plugin`,
      `$0 plugin import @yarnpkg/plugin-exec`,
    ], [
      `Download and activate the "@yarnpkg/plugin-exec" plugin (shorthand)`,
      `$0 plugin import exec`,
    ], [
      `Download and activate a community plugin`,
      `$0 plugin import https://example.org/path/to/plugin.js`,
    ], [
      `Activate a local plugin`,
      `$0 plugin import ./path/to/plugin.js`,
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

      let pluginSpec: string;
      let pluginBuffer: Buffer;
      if (this.name.match(/^\.{0,2}[\\/]/) || npath.isAbsolute(this.name)) {
        const candidatePath = ppath.resolve(this.context.cwd, npath.toPortablePath(this.name));

        report.reportInfo(MessageName.UNNAMED, `Reading ${configuration.format(candidatePath, `green`)}`);

        pluginSpec = ppath.relative(project.cwd, candidatePath);
        pluginBuffer = await xfs.readFilePromise(candidatePath);
      } else {
        let pluginUrl: string;
        if (this.name.match(/^https?:/)) {
          try {
            // @ts-ignore We don't want to add the dom to the TS env just for this line
            new URL(this.name);
          } catch {
            throw new ReportError(MessageName.INVALID_PLUGIN_REFERENCE, `Plugin specifier "${this.name}" is neither a plugin name nor a valid url`);
          }

          pluginSpec = this.name;
          pluginUrl = this.name;
        } else {
          const ident = structUtils.parseIdent(this.name.replace(/^((@yarnpkg\/)?plugin-)?/, `@yarnpkg/plugin-`));
          const identStr = structUtils.stringifyIdent(ident);
          const data = await getAvailablePlugins(configuration);

          if (!Object.prototype.hasOwnProperty.call(data, identStr))
            throw new ReportError(MessageName.PLUGIN_NAME_NOT_FOUND, `Couldn't find a plugin named "${identStr}" on the remote registry. Note that only the plugins referenced on our website (https://github.com/yarnpkg/berry/blob/master/plugins.yml) can be referenced by their name; any other plugin will have to be referenced through its public url (for example https://github.com/yarnpkg/berry/raw/master/packages/plugin-typescript/bin/%40yarnpkg/plugin-typescript.js).`);

          pluginSpec = identStr;
          pluginUrl = data[identStr].url;
        }

        report.reportInfo(MessageName.UNNAMED, `Downloading ${configuration.format(pluginUrl, `green`)}`);
        pluginBuffer = await httpUtils.get(pluginUrl, {configuration});
      }

      await savePlugin(pluginSpec, pluginBuffer, {project, report});
    });

    return report.exitCode();
  }
}

export async function savePlugin(pluginSpec: string, pluginBuffer: Buffer, {project, report}: {project: Project, report: Report}) {
  const {configuration} = project;

  const vmExports = {} as any;
  const vmModule = {exports: vmExports};

  runInNewContext(pluginBuffer.toString(), {
    module: vmModule,
    exports: vmExports,
  });

  const pluginName = vmModule.exports.name;

  const relativePath = `.yarn/plugins/${pluginName}.cjs` as PortablePath;
  const absolutePath = ppath.resolve(project.cwd, relativePath);

  report.reportInfo(MessageName.UNNAMED, `Saving the new plugin in ${configuration.format(relativePath, `magenta`)}`);
  await xfs.mkdirpPromise(ppath.dirname(absolutePath));
  await xfs.writeFilePromise(absolutePath, pluginBuffer);

  const pluginMeta = {
    path: relativePath,
    spec: pluginSpec,
  };

  await Configuration.updateConfiguration(project.cwd, (current: any) => {
    const plugins = [];
    let hasBeenReplaced = false;

    for (const entry of current.plugins || []) {
      const userProvidedPath = typeof entry !== `string`
        ? entry.path
        : entry;

      const pluginPath = ppath.resolve(project.cwd, npath.toPortablePath(userProvidedPath));
      const {name} = miscUtils.dynamicRequire(npath.fromPortablePath(pluginPath));

      if (name !== pluginName) {
        plugins.push(entry);
      } else {
        plugins.push(pluginMeta);
        hasBeenReplaced = true;
      }
    }

    if (!hasBeenReplaced)
      plugins.push(pluginMeta);

    return {plugins};
  });
}
