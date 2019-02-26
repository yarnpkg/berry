#!/usr/bin/env node

const {concierge} = require(`@manaflair/concierge`);
const path = require(`path`);
const {RawSource} = require(`webpack-sources`);
const webpack = require(`webpack`);

const basedir = process.cwd();
const dynamicLibs = require(`./dynamic-libs`);
const makeConfig = require(`./make-config`);

concierge
  .command(`<plugin-dir>`)
  .action(async ({stdout, stderr, pluginDir}) => {
    const {name} = require(`${path.resolve(process.cwd(), pluginDir)}/package.json`);

    const compiler = webpack(makeConfig({
      context: basedir,

      entry: `${name}`,

      output: {
        filename: `${name}.js`,
        path: path.resolve(basedir, `bin`),
        libraryTarget: `var`,
        library: `plugin`,
      },

      externals: [
        (context, request, callback) => {
          if (request !== name && (dynamicLibs.has(request) || request.match(/^(@[^\/]+\/)?plugin-/))) {
            callback(null, `commonjs ${request}`);
          } else {
            callback();
          }
        },
      ],

      plugins: [
        { apply: compiler => {
          compiler.hooks.compilation.tap(`MyPlugin`, compilation => {
            compilation.hooks.optimizeChunkAssets.tap(`MyPlugin`, chunks => {
              for (const chunk of chunks) {
                for (const file of chunk.files) {
                  compilation.assets[file] = new RawSource(`module.exports = function (require) {\n\n${
                    compilation.assets[file].source()
                  }\n\nreturn plugin;\n};\n\nmodule.exports.name = ${JSON.stringify(name)};\n`);
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

concierge
  .runExit(process.argv0, process.argv.slice(2));
