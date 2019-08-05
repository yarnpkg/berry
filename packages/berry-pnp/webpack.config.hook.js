require(`@berry/pnpify/lib`).patchFs();

const {makeConfig} = require(`@berry/builder/lib/tools/makeConfig`);
const {RawSource} = require(`webpack-sources`);

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
