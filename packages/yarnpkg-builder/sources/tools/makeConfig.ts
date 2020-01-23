// @ts-ignore
import PnpWebpackPlugin from 'pnp-webpack-plugin';
import merge            from 'webpack-merge';
import webpack          from 'webpack';

export const makeConfig = (config: webpack.Configuration) => merge({
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
    mainFields: [`main`],
    plugins: [PnpWebpackPlugin],
  },

  module: {
    rules: [{
      test: /\.tsx?$/,
      exclude: /\.d\.ts$/,
      use: [{
        loader: require.resolve(`babel-loader`),
        options: {
          plugins: [
            [require.resolve("@babel/plugin-syntax-decorators"), {"legacy": true}],
            [require.resolve("@babel/plugin-syntax-class-properties"), {"loose": true}],
            require.resolve(`babel-plugin-lazy-import`),
          ],
        },
      }, {
        loader: require.resolve(`ts-loader`),
        options: {
          compilerOptions: {declaration: false},
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
    new webpack.IgnorePlugin(/^encoding$/, /node-fetch/),
    new webpack.DefinePlugin({[`IS_WEBPACK`]: `true`}),
    new webpack.optimize.LimitChunkCountPlugin({maxChunks: 1}),
  ],
}, config);
