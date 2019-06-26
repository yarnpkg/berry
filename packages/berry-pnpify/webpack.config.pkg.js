const makeConfig = require(`@berry/builder/sources/make-config.js`);
const webpack = require(`webpack`);

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
