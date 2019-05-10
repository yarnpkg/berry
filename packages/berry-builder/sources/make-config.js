const path = require(`path`);
const webpack = require(`webpack`);
const merge = require(`webpack-merge`);
const PnpWebpackPlugin = require(`pnp-webpack-plugin`);

if (module.parent.filename.indexOf('berry-pnpify') < 0) {
  // Required for ts-loader for now to find type roots itself by scaning node_modules
  require('@berry/pnpify/lib').patchFs();
}

module.exports = config => merge({
  mode: `none`,
  devtool: false,

  target: `node`,

  node: {
    __dirname: false,
    __filename: false,
  },

  output: {
    libraryTarget: `commonjs2`,
  },

  resolve: {
    alias: {
      [`supports-color`]: `supports-color/index`,
      [`agentkeepalive`]: `agentkeepalive/index`,
    },
    extensions: [`.js`, `.ts`, `.tsx`, `.json`],
    mainFields: [`browser`, `module`, `main`],
    plugins: [PnpWebpackPlugin],
  },

  resolveLoader: {
    modules: [`${__dirname}/../node_modules`],
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
}, config);
