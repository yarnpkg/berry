#!/usr/bin/env node

const {concierge, UsageError} = require(`@manaflair/concierge`);
const path = require(`path`);
const webpack = require(`webpack`);

const basedir = process.cwd();
const commonConfig = require(`./common-config`);

concierge
  .command(`[-w,--watch] [--profile TYPE] [--plugin PLUGIN ...]`)
    .action(async ({watch, profile, plugin}) => {
    const pkgJson = require(`${basedir}/package.json`);

    if (!pkgJson[`@berry/builder`] || !pkgJson[`@berry/builder`].bundles)
      throw new UsageError(`This command requires your package.json to contain specific configuration keys`);

    if (!profile)
      profile = `standard`;

    if (!Object.prototype.hasOwnProperty.call(pkgJson[`@berry/builder`].bundles, profile))
      throw new UsageError(`Invalid profile`);

    const plugins = Array.from(new Set(pkgJson[`@berry/builder`].bundles[profile].concat(plugin)));

    const hookConfig = {
      context: basedir,
      entry: `@berry/pnp/sources/hook.ts`,
      output: {
        filename: `hook-bundle.js`,
        path: path.resolve(basedir, `lib`),
        libraryTarget: `commonjs2`,
      },
      ... commonConfig,
    };

    const mainConfig = {
      context: basedir,
      entry: `./sources/index.ts`,
      output: {
        filename: `berry.js`,
        path: path.resolve(basedir, `bin`),
      },
      ... commonConfig,
    };

    Object.assign(mainConfig.resolve.alias, {
        [`@berry/pnp/hook-bundle`]: path.resolve(basedir, `lib/hook-bundle.js`),
    });

    mainConfig.module.rules.push({
      test: path.resolve(basedir, `sources/plugins-embed.js`),
      use: {
        loader: require.resolve(`val-loader`),
        options: {plugins},
      },
    });

    if (!watch) {
      const compilers = [
        webpack(hookConfig),
        webpack(mainConfig),
      ];

      for (const compiler of compilers) {
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
          process.stderr.write(buildErrors);
          process.stderr.write(`\n`);
          return 1;
        }
      }

      console.log(`\u{1F525} Bundle successfully generated with the '${profile}' profile `);
    } else {
      const compiler = webpack([
        hookConfig,
        mainConfig,
      ]);

      await new Promise((resolve, reject) => {
        compiler.watch({}, (err, {stats: allStats}) => {
          if (err) {
            reject(err);
          } else {
            const erroredStats = [];

            for (const stats of allStats)
              if (stats.compilation.errors.length > 0)
                erroredStats.push(stats.toString(`errors-only`));
            
            if (erroredStats.length === 0) {
              process.stderr.write(String(`Build succeeded at ${new Date()}\n`));
            } else {
              process.stderr.write(String(`Build failed at ${new Date()}\n`));
            }

            for (const stats of erroredStats) {
              process.stderr.write(stats.toString(`errors-only`));
              process.stderr.write(`\n`);
            }
          }
        });
      });
    }
  });

concierge
  .runExit(process.argv0, process.argv.slice(2));
