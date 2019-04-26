const makeConfig = require(`@berry/builder/sources/make-config.js`);

module.exports = makeConfig({
  context: __dirname,

  entry: {
    [`index`]: `./sources/index.ts`,
    [`tsserver`]: `./sources/tsserver.ts`
  },

  output: {
    filename: `[name].js`,
    path: `${__dirname}/lib`,
  },
});
