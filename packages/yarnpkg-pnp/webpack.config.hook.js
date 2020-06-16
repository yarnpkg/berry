const {makeConfig} = require(`@yarnpkg/builder/sources/tools/makeConfig`);
const {RawSource} = require(`webpack-sources`);
const {brotliCompressSync} = require(`zlib`);

module.exports = makeConfig({
  context: __dirname,

  mode: `production`,
  optimization: {
    minimize: false,
  },

  entry: {
    [`hook`]: `./sources/loader/_entryPoint.ts`,
  },

  output: {
    filename: `[name].js`,
    path: `${__dirname}/sources`,
    libraryExport: `default`,
    libraryTarget: `umd`,
    library: `pnpHook`,
  },

  plugins: [
    {apply: compiler => {
      compiler.hooks.compilation.tap(`MyPlugin`, compilation => {
        compilation.hooks.optimizeChunkAssets.tap(`MyPlugin`, chunks => {
          for (const chunk of chunks) {
            for (const file of chunk.files) {
              compilation.assets[file] = new RawSource(
                `module.exports = require('zlib').brotliDecompressSync(Buffer.from('${brotliCompressSync(compilation.assets[file].source().replace(/\r\n/g, `\n`)).toString(`base64`)}', 'base64')).toString();\n`
              );
            }
          }
        });
      });
    }},
  ],
});
