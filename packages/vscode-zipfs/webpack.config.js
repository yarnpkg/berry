const path = require(`path`);

module.exports = {
  mode: process.env.NODE_ENV || `production`,
  devtool: false,

  target: `node10.19`,

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
  },
};
