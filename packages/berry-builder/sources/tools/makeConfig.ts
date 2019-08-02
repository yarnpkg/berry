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
    alias: {
      [`supports-color`]: `supports-color/index`,
      [`agentkeepalive`]: `agentkeepalive/index`,
    },
    extensions: [`.js`, `.ts`, `.tsx`, `.json`],
    mainFields: [`browser`, `module`, `main`],
    plugins: [PnpWebpackPlugin],
  },

  module: {
    rules: [{
      test: /\.tsx?$/,
      exclude: /\.d\.ts$/,
      loader: require.resolve(`ts-loader`),
      options: PnpWebpackPlugin.tsLoaderOptions({
        compilerOptions: {
          declaration: false,
        },
      }),
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
