#!/usr/bin/env node

const {Cli, Command} = require(`clipanion`);
const path = require(`path`);
const webpack = require(`webpack`);

const basedir = process.cwd();
const dynamicLibs = require(`./dynamic-libs`);
const findPlugins = require(`./find-plugins`);
const makeConfig = require(`./make-config`);

const pkgJsonVersion = () => {
  const pkgJson = require(`${basedir}/package.json`);
  return JSON.stringify(pkgJson["version"]);
}

class BuildBundleCommand extends Command {
  async execute() {
    const plugins = findPlugins({basedir, profile: this.profile, plugins: this.plugins || []});
    const modules = Array.from(dynamicLibs).concat(plugins);

    this.context.stdout.write(`The following plugins will be compiled in the final bundle:\n\n`);

    for (const plugin of plugins)
      this.context.stdout.write(`- ${plugin}\n`);

    const compiler = webpack(makeConfig({
      context: basedir,

      bail: true,

      entry: `./sources/cli.ts`,

      output: {
        filename: `berry.js`,
        path: `${basedir}/bundles`,
      },

      module: {
        rules: [{
          // This file is particular in that it exposes the bundle
          // configuration to the bundle itself (primitive introspection).
          test: path.resolve(basedir, `sources/pluginConfiguration.raw.js`),
          use: {
            loader: require.resolve(`val-loader`),
            options: {modules, plugins},
          },
        }],
      },

      plugins: [
        new webpack.BannerPlugin({
          entryOnly: true,
          banner: `#!/usr/bin/env node`,
          raw: true,
        }),
        new webpack.DefinePlugin({
          [`BERRY_VERSION`]: pkgJsonVersion(),
        }),
      ],
    }));

    if (!this.watch) {
      const buildErrors = await new Promise((resolve, reject) => {
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
        this.context.stdout.write(`\n`);
        this.context.stderr.write(buildErrors);
        this.context.stderr.write(`\n`);
        return 1;
      } else {
        this.context.stdout.write(`\nDone!\n`);
        return 0;
      }
    } else {
      compiler.watch({}, (err, {stats: allStats}) => {
        if (err) {
          reject(err);
        } else {
          const erroredStats = [];
          for (const stats of allStats)
            if (stats.compilation.errors.length > 0)
              erroredStats.push(stats.toString(`errors-only`));

          if (erroredStats.length === 0) {
            this.context.stderr.write(String(`Build succeeded at ${new Date()}\n`));
          } else {
            this.context.stderr.write(String(`Build failed at ${new Date()}\n`));
          }

          for (const stats of erroredStats) {
            this.context.stderr.write(stats.toString(`errors-only`));
            this.context.stderr.write(`\n`);
          }
        }
      });
    }
  }
};

const cli = new Cli();

Command.Boolean(`-w,--watch`)(BuildBundleCommand.prototype, `watch`);
Command.String(`--profile`)(BuildBundleCommand.prototype, `profile`);
Command.Array(`--plugin`)(BuildBundleCommand.prototype, `plugins`);

cli.register(BuildBundleCommand);
cli.runExit(process.argv.slice(2), {
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
});
