const webpack = require(`webpack`);

// We require it through a relative path rather than an actual dependency
// because this file is only needed when building the PnPify tools (so from
// within the repository), and it allows us to prevent a circular dependency
// in the dependency tree (because `@berry/builder` has a dependency on
// `@berry/pnpify`).
const {makeConfig} = require(`../berry-builder/lib/tools/makeConfig.js`);

module.exports = makeConfig({
  context: __dirname,

  mode: `production`,
  optimization: {
    minimize: false
  },

  entry: {
    [`bin`]: `./sources/bin.ts`,
    [`index`]: `./sources/index.ts`
  },

  output: {
    filename: `[name].js`,
    path: `${__dirname}/lib`,
  },

  plugins: [
    new webpack.BannerPlugin({
      entryOnly: true,
      include: `bin`,
      banner: `#!/usr/bin/env node`,
      raw: true,
    }),
  ],
});
