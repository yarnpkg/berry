const path = require(`path`);

module.exports = {
  mode: `production`,
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
  },
};
