const makeConfig = require(`@berry/builder/sources/make-config.js`);
const {RawSource} = require(`webpack-sources`);

module.exports = makeConfig({
  context: __dirname,

  entry: {
    [`hook`]: `./sources/loader/_entryPoint.ts`,
  },

  output: {
    filename: `[name].js`,
    path: `${__dirname}/bundles`,
  },

  plugins: [
    { apply: compiler => {
      compiler.hooks.compilation.tap('MyPlugin', compilation => {
        compilation.hooks.optimizeChunkAssets.tap(`RawPlugin`, chunks => {
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
