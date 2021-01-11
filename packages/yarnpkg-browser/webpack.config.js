const webpack = require(`webpack`);

module.exports = {
  mode: `development`,

  context: __dirname,
  entry: `./sources/index.ts`,

  output: {
    filename: `index.js`,
  },

  resolve: {
    extensions: [`.mjs`, `.js`, `.ts`, `.tsx`, `.json`],

    alias: {
      assert: require.resolve(`assert/`),
      buffer: require.resolve(`buffer/`),
      crypto: require.resolve(`crypto-browserify`),
      events: require.resolve(`events/`),
      fs: require.resolve(`./sources/polyfills/fs`),
      os: require.resolve(`os-browserify`),
      path: require.resolve(`path/`),
      querystring: require.resolve(`querystring/`),
      stream: require.resolve(`stream-browserify`),
      // eslint-disable-next-line @typescript-eslint/naming-convention
      string_decoder: require.resolve(`string_decoder/`),
      tty: require.resolve(`tty-browserify`),
      url: require.resolve(`url/`),
      util: require.resolve(`util/`),
      zlib: require.resolve(`browserify-zlib`),
    },
  },

  module: {
    rules: [{
      test: /\/ContainerWorker\.[tj]s$/,
      loader: require.resolve(`worker-loader`),
    }, {
      test: /\.ts$/,
      loader: require.resolve(`ts-loader`),
      options: {
        compilerOptions: {declaration: false},
      },
    }, {
      test: /\.js$/,
      resourceQuery: /^\?raw$/,
      loader: require.resolve(`raw-loader`),
    }],
  },

  plugins: [
    new webpack.ProvidePlugin({
      Buffer: [require.resolve(`buffer/`), `Buffer`],
      process: require.resolve(`./sources/polyfills/process`),
    }),
  ],

  devServer: {
    contentBase: `${__dirname}/demo`,
  },
};
