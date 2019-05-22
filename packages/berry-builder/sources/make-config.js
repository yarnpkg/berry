const webpack = require(`webpack`);
const merge = require(`webpack-merge`);
const PnpWebpackPlugin = require(`pnp-webpack-plugin`);

// TypeScript (ts-loader) isn't able to find out the typeRoots when using zip
// loading (because they're stored within the zip files). So we need to use
// PnPify to help them find them.
//
// We don't need to do this for PnPify itself (hence the check) because we
// explicitly list all the typeRoots within its tsconfig (otherwise it would
// need to use itself to build itself 🤡).
if (!module.parent.filename.includes(`berry-pnpify`))
  require(`@berry/pnpify/lib`).patchFs();

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
