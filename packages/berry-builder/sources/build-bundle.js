#!/usr/bin/env node

const {concierge} = require(`@manaflair/concierge`);
const path = require(`path`);
const webpack = require(`webpack`);

const basedir = process.cwd();
const dynamicLibs = require(`./dynamic-libs`);
const findPlugins = require(`./find-plugins`);
const makeConfig = require(`./make-config`);

concierge
  .command(`[-w,--watch] [--profile TYPE] [--plugin PLUGIN ...]`)
  .action(async ({watch, profile, plugin, stdout, stderr}) => {
    const plugins = findPlugins({basedir, profile, plugin});
    const modules = Array.from(dynamicLibs).concat(plugins);

    stdout.write(`The following plugins will be compiled in the final bundle:\n\n`);

    for (const plugin of plugins)
      stdout.write(`- ${plugin}\n`);

    const compiler = webpack(makeConfig({
      context: basedir,

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
      ],
    }));

    if (!watch) {
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
        stdout.write(`\n`);
        stderr.write(buildErrors);
        stderr.write(`\n`);
        return 1;
      } else {
        stdout.write(`\nDone!\n`);
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
            stderr.write(String(`Build succeeded at ${new Date()}\n`));
          } else {
            stderr.write(String(`Build failed at ${new Date()}\n`));
          }

          for (const stats of erroredStats) {
            stderr.write(stats.toString(`errors-only`));
            stderr.write(`\n`);
          }
        }
      });
    }
  });

concierge
  .runExit(process.argv0, process.argv.slice(2));
