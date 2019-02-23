const makeConfig = require(`@berry/builder/sources/make-config.js`);

module.exports = makeConfig({
  context: __dirname,

  entry: {
    [`index`]: `./sources/index.ts`,
    [`microkernel`]: `./sources/microkernel.ts`,
  },

  output: {
    filename: `[name].js`,
    path: `${__dirname}/bundles`,
  },
});
