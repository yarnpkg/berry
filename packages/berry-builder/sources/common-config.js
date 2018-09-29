const path = require(`path`);
const webpack = require(`webpack`);

const PnpWebpackPlugin = require(`./webpack-resolver`);

module.exports = {
  mode: `development`,
  devtool: false,

  target: `node`,

  node: {
    __dirname: false,
  },

  resolve: {
    alias: {},
    extensions: [`.js`, `.ts`, `.tsx`, `.json`],
    plugins: [PnpWebpackPlugin],
  },

  resolveLoader: {
    plugins: [PnpWebpackPlugin],
  },

  module: {
    rules: [{
      test: /\.tsx?$/,
      use: path.dirname(require.resolve(`ts-loader/package.json`)),
    }, {
      test: /\.wasm$/,
      type: `javascript/auto`,
      use: path.dirname(require.resolve(`buffer-loader/package.json`)),
    }, {
      test: /\/node_modules\/@manaflair\/text-layout\/[^\/]+\.js$/,
      use: path.dirname(require.resolve(`transform-loader/package.json`)) + `?` + path.dirname(require.resolve(`brfs/package.json`)),
    }],
  },

  plugins: [
    new webpack.IgnorePlugin(/^encoding$/, /node-fetch/),
    new webpack.DefinePlugin({[`IS_WEBPACK`]: `true`}),
  ],
};
