import chalk            from 'chalk';
import {Command, Usage} from 'clipanion';
import filesize         from 'filesize';
import fs               from 'fs';
import path             from 'path';
import TerserPlugin     from 'terser-webpack-plugin';
import webpack          from 'webpack';

import {dynamicLibs}    from '../../data/dynamicLibs';
import {findPlugins}    from '../../tools/findPlugins';
import {makeConfig}     from '../../tools/makeConfig';

const pkgJsonVersion = (basedir: string) => {
  const pkgJson = require(`${basedir}/package.json`);
  return JSON.stringify(pkgJson["version"]);
};

// eslint-disable-next-line arca/no-default-export
export default class BuildBundleCommand extends Command {
  @Command.String(`--profile`)
  profile: string = `standard`;

  @Command.Array(`--plugin`)
  plugins: Array<string> = [];

  @Command.Boolean(`--no-minify`)
  noMinify: boolean = false;

  static usage: Usage = Command.Usage({
    description: `build the local bundle`,
  });

  @Command.Path(`build`, `bundle`)
  async execute() {
    const basedir = process.cwd();
    const plugins = findPlugins({basedir, profile: this.profile, plugins: this.plugins});
    const modules = Array.from(dynamicLibs).concat(plugins);
    const output = `${basedir}/bundles/yarn.js`;

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
            }),
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
          test: /[\\\/]getPluginConfiguration\.val\.js$/,
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
          [`YARN_VERSION`]: pkgJsonVersion(basedir),
        }),
      ],
    }));

    const buildErrors = await new Promise<string | null>((resolve, reject) => {
      compiler.run((err, stats) => {
        if (err) {
          reject(err);
        } else if (stats.compilation.errors.length > 0) {
          resolve(stats.toString(`errors-only`));
        } else {
          resolve(null);
        }
      });
    });

    if (buildErrors) {
      this.context.stdout.write(`${chalk.red(`✗`)} Failed to build the CLI:\n`);
      this.context.stdout.write(`${buildErrors}\n`);
      return 1;
    } else {
      this.context.stdout.write(`${chalk.green(`✓`)} Done building the CLI!\n`);
      this.context.stdout.write(`${chalk.cyan(`?`)} Bundle path: ${output}\n`);
      this.context.stdout.write(`${chalk.cyan(`?`)} Bundle size: ${filesize(fs.statSync(output).size)}\n`);
      for (const plugin of plugins)
        this.context.stdout.write(`    ${chalk.yellow(`→`)} ${plugin}\n`);
      return 0;
    }
  }
}
