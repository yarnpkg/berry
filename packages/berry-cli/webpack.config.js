const path = require(`path`);
const webpack = require(`webpack`);

const commonConfig = {

  mode: `development`,
  devtool: false,

  target: `node`,

  resolve: {
    extensions: [`.js`, `.ts`],
  },

  module: {
    rules: [{
      test: /\.ts$/,
      use: `ts-loader`,
    }, {
      test: /\.wasm$/,
      type: `javascript/auto`,
      use: `buffer-loader`,
    }],
  },

  plugins: [
    new webpack.IgnorePlugin(/^encoding$/, /node-fetch/),
    new webpack.DefinePlugin({[`IS_WEBPACK`]: `true`}),
  ],

};

module.exports = [{

  context: __dirname,
  entry: `@berry/pnp/sources/hook.ts`,

  output: {
    filename: `hook-bundle`,
    path: path.resolve(__dirname, `lib`),
  },

  ... commonConfig,

}, {

  context: __dirname,
  entry: `./sources/index.ts`,

  output: {
    filename: `berry`,
    path: path.resolve(__dirname, `bin`),
  },

  ... commonConfig,

}];
