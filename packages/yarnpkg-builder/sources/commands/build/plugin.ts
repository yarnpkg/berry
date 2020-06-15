import {StreamReport, MessageName, Configuration, structUtils, FormatType} from '@yarnpkg/core';
import {npath}                                                             from '@yarnpkg/fslib';
import chalk                                                               from 'chalk';
import {Command, Usage, UsageError}                                        from 'clipanion';
import filesize                                                            from 'filesize';
import fs                                                                  from 'fs';
import path                                                                from 'path';
import TerserPlugin                                                        from 'terser-webpack-plugin';
import {RawSource}                                                         from 'webpack-sources';
import webpack                                                             from 'webpack';

import {isDynamicLib}                                                      from '../../tools/isDynamicLib';
import {makeConfig, WebpackPlugin}                                         from '../../tools/makeConfig';

// The name gets normalized so that everyone can override some plugins by
// their own (@arcanis/yarn-plugin-foo would override @yarnpkg/plugin-foo
// as well as @mael/yarn-plugin-foo)
const getNormalizedName = (name: string) => {
  const parsing = name.match(/^(?:@yarnpkg\/|(?:@[^/]+\/)?yarn-)(plugin-[^/]+)/);
  if (parsing === null)
    throw new UsageError(`Invalid plugin name "${name}" - it should be "yarn-plugin-<something>"`);

  return `@yarnpkg/${parsing[1]}`;
};

// eslint-disable-next-line arca/no-default-export
export default class BuildPluginCommand extends Command {
  @Command.Boolean(`--no-minify`)
  noMinify: boolean = false;

  static usage: Usage = Command.Usage({
    description: `build a local plugin`,
    details: `
      This command builds a local plugin.

      If the \`--no-minify\` option is used, the plugin will be built in development mode, without any optimizations like minifying, symbol scrambling and treeshaking.
    `,
    examples: [[
      `Build a local plugin`,
      `$0 build plugin`,
    ], [
      `Build a local development plugin`,
      `$0 build plugin --no-minify`,
    ]],
  });

  @Command.Path(`build`, `plugin`)
  async execute() {
    const basedir = process.cwd();
    const portableBaseDir = npath.toPortablePath(basedir);
    const configuration = Configuration.create(portableBaseDir);

    const {name: rawName} = require(`${basedir}/package.json`);
    const name = getNormalizedName(rawName);
    const prettyName = structUtils.prettyIdent(configuration, structUtils.parseIdent(name));
    const output = `${basedir}/bundles/${name}.js`;

    let buildErrors: string | null = null;

    const report = await StreamReport.start({
      configuration,
      includeFooter: false,
      stdout: this.context.stdout,
      forgettableNames: new Set([MessageName.UNNAMED]),
    }, async report => {
      await report.startTimerPromise(`Building ${prettyName}`, async () => {
        const progress = StreamReport.progressViaCounter(1);
        report.reportProgress(progress);

        const prettyWebpack = structUtils.prettyIdent(configuration, structUtils.makeIdent(null, `webpack`));

        const compiler = webpack(makeConfig({
          context: basedir,
          entry: `.`,

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
            libraryTarget: `var`,
            library: `plugin`,
          },

          externals: [
            ({context, request}, callback: any) => {
              if (request !== name && isDynamicLib(request)) {
                callback(null, `commonjs ${request}`);
              } else {
                callback();
              }
            },
          ],

          plugins: [
            // This plugin wraps the generated bundle so that it doesn't actually
            // get evaluated right now - until after we give it a custom require
            // function that will be able to fetch the dynamic modules.
            {apply: (compiler: webpack.Compiler) => {
              compiler.hooks.compilation.tap(`MyPlugin`, (compilation: webpack.Compilation) => {
                compilation.hooks.optimizeChunkAssets.tap(`MyPlugin`, (chunks: Set<webpack.Chunk>) => {
                  for (const chunk of chunks) {
                    for (const file of chunk.files) {
                      // @ts-ignore
                      compilation.assets[file] = new RawSource(
                        [
                          `/* eslint-disable */`,
                          `module.exports = {`,
                          `name: ${JSON.stringify(name)},`,
                          `factory: function (require) {`,
                          compilation.assets[file].source(),
                          `return plugin;`,
                          `}`,
                          `};`,
                        ].join(`\n`)
                      );
                    }
                  }
                });
              });
            }},
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

    if (buildErrors !== null) {
      report.reportError(MessageName.EXCEPTION, `${chalk.red(`✗`)} Failed to build ${prettyName}:`);
      report.reportError(MessageName.EXCEPTION, `${buildErrors}`);
    } else {
      report.reportInfo(null, `${chalk.green(`✓`)} Done building ${prettyName}!`);
      report.reportInfo(null, `${chalk.cyan(`?`)} Bundle path: ${configuration.format(output, FormatType.PATH)}`);
      report.reportInfo(null, `${chalk.cyan(`?`)} Bundle size: ${configuration.format(filesize(fs.statSync(output).size), FormatType.NUMBER)}`);
    }

    return report.exitCode();
  }
}
