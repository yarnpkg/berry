import merge   from 'webpack-merge';
import webpack from 'webpack';

export type WebpackPlugin =
  | ((this: webpack.Compiler, compiler: webpack.Compiler) => void)
  | webpack.WebpackPluginInstance;

// @ts-ignore: @types/webpack-merge depends on @types/webpack, which isn't compatible with the webpack 5 types
export const makeConfig = (config: webpack.Configuration): webpack.Configuration => merge({
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
    extensions: [`.js`, `.ts`, `.tsx`, `.json`],
  },

  module: {
    rules: [{
      test: /\.tsx?$/,
      exclude: /\.d\.ts$/,
      use: [{
        loader: require.resolve(`babel-loader`),
      }, {
        loader: require.resolve(`ts-loader`),
        options: {
          compilerOptions: {
            declaration: false,
            module: `ESNext`,
            moduleResolution: `node`,
          },
        },
      }],
    }],
  },

  externals: {
    // Both of those are native dependencies of text-buffer we can't bundle
    [`fs-admin`]: `{}`,
    [`pathwatcher`]: `{}`,
  },

  plugins: [
    new webpack.IgnorePlugin({
      resourceRegExp: /^encoding$/,
      contextRegExp: /node-fetch/,
    }),
    new webpack.DefinePlugin({[`IS_WEBPACK`]: `true`}),
    new webpack.optimize.LimitChunkCountPlugin({maxChunks: 1}),
  ],
} as webpack.Configuration, config);
