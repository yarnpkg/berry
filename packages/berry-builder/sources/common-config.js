const path = require(`path`);
const webpack = require(`webpack`);
const PnpWebpackPlugin = require(`pnp-webpack-plugin`);
Error.stackTraceLimit=Infinity
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
    mainFields: [`browser`, `module`, `main`],
    plugins: [PnpWebpackPlugin],
  },

  resolveLoader: {
    plugins: [PnpWebpackPlugin.moduleLoader(module)],
  },

  module: {
    rules: [{
      test: /\.tsx?$/,
      exclude: /\.d\.ts$/,
      use: `ts-loader`,
    }, {
      test: /\.wasm$/,
      type: `javascript/auto`,
      use: `buffer-loader`,
    }, {
      test: /\/(@manaflair[\/-])?text-layout(-[a-f0-9]+\.zip)?\/[^\/]+\.js$/,
      use: `transform-loader?${path.dirname(require.resolve(`brfs/package.json`))}`,
    }],
  },

  externals: {
    // Both of those are native dependencies of text-buffer we can't bundle
    [`fs-admin`]: `{}`,
    [`pathwatcher`]: `{}`,
  },

  plugins: [
    new webpack.IgnorePlugin(/^encoding$/, /node-fetch/),
    new webpack.DefinePlugin({[`IS_WEBPACK`]: `true`}),
  ],
};
