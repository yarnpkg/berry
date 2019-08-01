const {RawSource} = require(`webpack-sources`);

// We require it through a relative path rather than an actual dependency
// because this file is only needed when building the PnPify tools (so from
// within the repository), and it allows us to prevent a circular dependency
// in the dependency tree (because `@berry/builder` has a dependency on
// `@berry/pnpify`).
const {makeConfig} = require(`../berry-builder/lib/tools/makeConfig.js`);

module.exports = makeConfig({
  context: __dirname,

  mode: 'production',
  optimization: {
    minimize: false
  },

  entry: {
    [`hook`]: `./sources/loader/_entryPoint.ts`,
  },

  output: {
    filename: `[name].js`,
    path: `${__dirname}/lib`,
  },

  plugins: [
    { apply: compiler => {
      compiler.hooks.compilation.tap(`MyPlugin`, compilation => {
        compilation.hooks.optimizeChunkAssets.tap(`MyPlugin`, chunks => {
          for (const chunk of chunks) {
            for (const file of chunk.files) {
              compilation.assets[file] = new RawSource(`module.exports = ${JSON.stringify(
                compilation.assets[file].source(),
              )};\n`);
            }
          }
        });
      });
    } },
  ],
});
