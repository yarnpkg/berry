const path = require(`path`);

module.exports = {

  mode: `development`,
  devtool: false,

  target: `node`,

  context: __dirname,
  entry: `ts-loader!raw-loader!./sources/hook.ts`,

  output: {
    filename: `hook.bundle.js`,
    path: path.resolve(__dirname, `sources`),
  },

  module: {
    rules: [{
      test: /\.ts$/,
      use: 'ts-loader',
    }],
  },

};
