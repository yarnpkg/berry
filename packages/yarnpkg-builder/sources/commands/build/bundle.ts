import {getDynamicLibs}                                                    from '@yarnpkg/cli';
import {StreamReport, MessageName, Configuration, structUtils, FormatType} from '@yarnpkg/core';
import {npath}                                                             from '@yarnpkg/fslib';
import chalk                                                               from 'chalk';
import cp                                                                  from 'child_process';
import {Command, Usage}                                                    from 'clipanion';
import filesize                                                            from 'filesize';
import fs                                                                  from 'fs';
import path                                                                from 'path';
import TerserPlugin                                                        from 'terser-webpack-plugin';
import {promisify}                                                         from 'util';
import webpack                                                             from 'webpack';

import {findPlugins}                                                       from '../../tools/findPlugins';
import {makeConfig, WebpackPlugin}                                         from '../../tools/makeConfig';

const execFile = promisify(cp.execFile);

const pkgJsonVersion = (basedir: string) => {
  return require(`${basedir}/package.json`).version;
};

const suggestHash = async (basedir: string) => {
  try {
    const unique = await execFile(`git`, [`show`, `-s`, `--pretty=format:%ad.%t`, `--date=short`], {cwd: basedir});
    return `.git.${unique.stdout.trim().replace(/-/g, ``)}`;
  } catch {
    return null;
  }
};

// eslint-disable-next-line arca/no-default-export
export default class BuildBundleCommand extends Command {
  @Command.String(`--profile`)
  profile: string = `standard`;

  @Command.Array(`--plugin`)
  plugins: Array<string> = [];

  @Command.Boolean(`--no-git-hash`)
  noGitHash: boolean = false;

  @Command.Boolean(`--no-minify`)
  noMinify: boolean = false;

  static usage: Usage = Command.Usage({
    description: `build the local bundle`,
  });

  @Command.Path(`build`, `bundle`)
  async execute() {
    const basedir = process.cwd();
    const portableBaseDir = npath.toPortablePath(basedir);

    const configuration = Configuration.create(portableBaseDir);

    const plugins = findPlugins({basedir, profile: this.profile, plugins: this.plugins.map(plugin => path.resolve(plugin))});
    const modules = [...getDynamicLibs().keys()].concat(plugins);
    const output = `${basedir}/bundles/yarn.js`;

    let version = pkgJsonVersion(basedir);

    const hash = !this.noGitHash
      ? await suggestHash(basedir)
      : null;

    if (hash !== null)
      version = version.replace(/-(.*)?$/, `-$1${hash}`);

    let buildErrors: string | null = null;

    const report = await StreamReport.start({
      configuration,
      includeFooter: false,
      stdout: this.context.stdout,
      forgettableNames: new Set([MessageName.UNNAMED]),
    }, async report => {
      await report.startTimerPromise(`Building the CLI`, async () => {
        const progress = StreamReport.progressViaCounter(1);
        report.reportProgress(progress);

        const prettyWebpack = structUtils.prettyIdent(configuration, structUtils.makeIdent(null, `webpack`));

        const compiler = webpack(makeConfig({
          context: basedir,
          entry: `./sources/cli.ts`,

          bail: true,

          ...!this.noMinify && {
            mode: `production`,
          },

          ...!this.noMinify && {
            optimization: {
              minimizer: [
                new TerserPlugin({
                  cache: false,
                  extractComments: false,
                  terserOptions: {
                    ecma: 8,
                  },
                }) as WebpackPlugin,
              ],
            },
          },

          output: {
            filename: path.basename(output),
            path: path.dirname(output),
          },

          resolve: {
            alias: {
              [path.resolve(basedir, `./sources/tools/getPluginConfiguration.ts`)]: path.resolve(basedir, `./sources/tools/getPluginConfiguration.val.js`),
            },
          },

          module: {
            rules: [{
            // This file is particular in that it exposes the bundle
            // configuration to the bundle itself (primitive introspection).
              test: /[\\/]getPluginConfiguration\.val\.js$/,
              use: {
                loader: require.resolve(`val-loader`),
                options: {modules, plugins},
              },
            }],
          },

          plugins: [
            new webpack.BannerPlugin({
              entryOnly: true,
              banner: `#!/usr/bin/env node\n/* eslint-disable */`,
              raw: true,
            }),
            new webpack.DefinePlugin({
              [`YARN_VERSION`]: JSON.stringify(version),
            }),
            new webpack.ProgressPlugin((percentage: number, message: string) => {
              progress.set(percentage);

              if (message) {
                report.reportInfoOnce(MessageName.UNNAMED, `${prettyWebpack}: ${message}`);
              }
            }),
          ],
        }));

        buildErrors = await new Promise<string | null>((resolve, reject) => {
          compiler.run((err, stats) => {
            if (err) {
              reject(err);
            } else if (stats && stats.compilation.errors.length > 0) {
              resolve(stats.toString(`errors-only`));
            } else {
              resolve(null);
            }
          });
        });
      });
    });

    report.reportSeparator();

    if (buildErrors) {
      report.reportError(MessageName.EXCEPTION, `${chalk.red(`✗`)} Failed to build the CLI:`);
      report.reportError(MessageName.EXCEPTION, `${buildErrors}`);
    } else {
      report.reportInfo(null, `${chalk.green(`✓`)} Done building the CLI!`);
      report.reportInfo(null, `${chalk.cyan(`?`)} Bundle path: ${configuration.format(output, FormatType.PATH)}`);
      report.reportInfo(null, `${chalk.cyan(`?`)} Bundle size: ${configuration.format(filesize(fs.statSync(output).size), FormatType.NUMBER)}`);

      report.reportSeparator();

      for (const plugin of plugins) {
        report.reportInfo(null, `${chalk.yellow(`→`)} ${structUtils.prettyIdent(configuration, structUtils.parseIdent(plugin))}`);
      }
    }

    return report.exitCode();
  }
}
