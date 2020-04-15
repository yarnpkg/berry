const path = require(`path`);
const PnpWebpackPlugin = require(`pnp-webpack-plugin`);

module.exports = {
  mode: `development`,
  devtool: false,

  target: `node`,

  context: __dirname,
  entry: `./sources/index.ts`,

  output: {
    filename: `index.js`,
    libraryTarget: `commonjs2`,
    path: path.resolve(__dirname, `build`),
  },

  module: {
    rules: [{
      test: /\.ts$/,
      loader: `ts-loader`,
      options: {
        compilerOptions: {declaration: false},
      },
    }],
  },

  externals: {
    [`vscode`]: `vscode`,
  },

  resolve: {
    extensions: [`.ts`, `.js`],
    plugins: [
      PnpWebpackPlugin,
    ],
  },

  resolveLoader: {
    plugins: [
      PnpWebpackPlugin.moduleLoader(module),
    ],
  },
};
