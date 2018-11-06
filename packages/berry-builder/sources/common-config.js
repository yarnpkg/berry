const path = require(`path`);
const webpack = require(`webpack`);
const PnpWebpackPlugin = require(`pnp-webpack-plugin`);

module.exports = {
  mode: `development`,
  devtool: false,

  target: `node`,

  node: {
    __dirname: false,
  },

  resolve: {
    alias: {[`supports-color`]: `supports-color/index`},
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
      loader: `ts-loader`,
      options: PnpWebpackPlugin.tsLoaderOptions(),
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
