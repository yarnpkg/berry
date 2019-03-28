#!/usr/bin/env node

const {clipanion} = require(`clipanion`);
const path = require(`path`);
const {RawSource} = require(`webpack-sources`);
const webpack = require(`webpack`);

const dynamicLibs = require(`./dynamic-libs`);
const makeConfig = require(`./make-config`);

// All packages that match one of our registered dynamic library or a name
// pattern that would point to a plugin are left alone so that we can link
// them at runtime.
const isDynamicLib = request =>
  dynamicLibs.has(request) ||
  request.match(/^@berry\/plugin-/);

// The name gets normalized so that everyone can override some plugins by
// their own (@arcanis/berry-plugin-foo would override @berry/plugin-foo
// as well as @mael/berry-plugin-foo)
const getNormalizedName = name => {
  const parsing = name.match(/^(?:@berry\/|(?:@[^\/]+\/)?berry-)(plugin-[^\/]+)/);
  if (parsing === null)
    throw new Error(`Invalid plugin name "${name}"`);
  return `@berry/${parsing[1]}`;
};

clipanion
  .command(`[plugin-dir]`)
  .action(async ({stdout, stderr, pluginDir = `.`}) => {
    const pluginPath = path.resolve(process.cwd(), pluginDir);
    const {name} = require(`${pluginPath}/package.json`);
    const pluginName = getNormalizedName(name);

    const compiler = webpack(makeConfig({
      context: pluginPath,
      entry: `.`,

      output: {
        filename: `${pluginName}.js`,
        path: `${pluginPath}/bundles`,
        libraryTarget: `var`,
        library: `plugin`,
      },

      externals: [
        (context, request, callback) => {
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
        { apply: compiler => {
          compiler.hooks.compilation.tap(`MyPlugin`, compilation => {
            compilation.hooks.optimizeChunkAssets.tap(`MyPlugin`, chunks => {
              for (const chunk of chunks) {
                for (const file of chunk.files) {
                  compilation.assets[file] = new RawSource(`
                    module.exports = {};

                    module.exports.factory = function (require) {
                      ${compilation.assets[file].source()}
                      return plugin;
                    };

                    module.exports.name = ${JSON.stringify(pluginName)};
                  `);
                }
              }
            });
          });
        } },
      ],
    }));

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
  });

clipanion
  .runExit(process.argv0, process.argv.slice(2));
