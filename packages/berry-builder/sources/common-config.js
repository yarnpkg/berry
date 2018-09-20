const path = require(`path`);
const webpack = require(`webpack`);

module.exports = {

  mode: `development`,
  devtool: false,

  target: `node`,

  resolve: {
    extensions: [`.js`, `.ts`, `.tsx`, `.json`],
  },

  module: {
    rules: [{
      test: /\.tsx?$/,
      use: `ts-loader`,
    }, {
      test: /\.wasm$/,
      type: `javascript/auto`,
      use: `buffer-loader`,
    }, {
      test: /\/node_modules\/@manaflair\/text-layout\/[^\/]+\.js$/,
      use: `transform-loader?brfs`,
    }],
  },

  plugins: [
    new webpack.IgnorePlugin(/^encoding$/, /node-fetch/),
    new webpack.DefinePlugin({[`IS_WEBPACK`]: `true`}),
  ],

};
