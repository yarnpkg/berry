import {BaseCommand}                                                    from '@yarnpkg/cli';
import {structUtils, hashUtils}                                         from '@yarnpkg/core';
import {Configuration, MessageName, Project, ReportError, StreamReport} from '@yarnpkg/core';
import {PortablePath, npath, ppath, xfs, Filename}                      from '@yarnpkg/fslib';
import {Command, Option, Usage}                                         from 'clipanion';
import {tmpdir}                                                         from 'os';

import {prepareRepo, runWorkflow}                                       from '../../set/version/sources';
import {savePlugin}                                                     from '../import';
import {getAvailablePlugins}                                            from '../list';

const buildWorkflow = ({pluginName, noMinify}: {noMinify: boolean, pluginName: string}, target: PortablePath) => [
  [`yarn`, `build:${pluginName}`, ...noMinify ? [`--no-minify`] : [], `|`],
];

// eslint-disable-next-line arca/no-default-export
export default class PluginDlSourcesCommand extends BaseCommand {
  static paths = [
    [`plugin`, `import`, `from`, `sources`],
  ];

  static usage: Usage = Command.Usage({
    category: `Plugin-related commands`,
    description: `build a plugin from sources`,
    details: `
      This command clones the Yarn repository into a temporary folder, builds the specified contrib plugin and updates the configuration to reference it in further CLI invocations.

      The plugins can be referenced by their short name if sourced from the official Yarn repository.
    `,
    examples: [[
      `Build and activate the "@yarnpkg/plugin-exec" plugin`,
      `$0 plugin import from sources @yarnpkg/plugin-exec`,
    ], [
      `Build and activate the "@yarnpkg/plugin-exec" plugin (shorthand)`,
      `$0 plugin import from sources exec`,
    ]],
  });

  installPath = Option.String(`--path`, {
    description: `The path where the repository should be cloned to`,
  });

  repository = Option.String(`--repository`, `https://github.com/yarnpkg/berry.git`, {
    description: `The repository that should be cloned`,
  });

  branch = Option.String(`--branch`, `master`, {
    description: `The branch of the repository that should be cloned`,
  });

  noMinify = Option.Boolean(`--no-minify`, false, {
    description: `Build a plugin for development (debugging) - non-minified and non-mangled`,
  });

  force = Option.Boolean(`-f,--force`, false, {
    description: `Always clone the repository instead of trying to fetch the latest commits`,
  });

  name = Option.String();

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);

    const target = typeof this.installPath !== `undefined`
      ? ppath.resolve(this.context.cwd, npath.toPortablePath(this.installPath))
      : ppath.resolve(npath.toPortablePath(tmpdir()), `yarnpkg-sources` as Filename, hashUtils.makeHash(this.repository).slice(0, 6) as Filename);

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async report => {
      const {project} = await Project.find(configuration, this.context.cwd);

      const ident = structUtils.parseIdent(this.name.replace(/^((@yarnpkg\/)?plugin-)?/, `@yarnpkg/plugin-`));
      const identStr = structUtils.stringifyIdent(ident);
      const data = await getAvailablePlugins(configuration);

      if (!Object.prototype.hasOwnProperty.call(data, identStr))
        throw new ReportError(MessageName.PLUGIN_NAME_NOT_FOUND, `Couldn't find a plugin named "${identStr}" on the remote registry. Note that only the plugins referenced on our website (https://github.com/yarnpkg/berry/blob/master/plugins.yml) can be built and imported from sources.`);

      const pluginSpec = identStr;
      const pluginName = pluginSpec.replace(/@yarnpkg\//, ``);

      await prepareRepo(this, {configuration, report, target});

      report.reportSeparator();
      report.reportInfo(MessageName.UNNAMED, `Building a fresh ${pluginName}`);
      report.reportSeparator();

      await runWorkflow(buildWorkflow({
        pluginName,
        noMinify: this.noMinify,
      }, target), {configuration, context: this.context, target});

      report.reportSeparator();

      const pluginPath = ppath.resolve(target, `packages/${pluginName}/bundles/${pluginSpec}.js` as PortablePath);
      const pluginBuffer = await xfs.readFilePromise(pluginPath);

      await savePlugin(pluginSpec, pluginBuffer, {project, report});
    });

    return report.exitCode();
  }
}
