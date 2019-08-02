require(`@berry/pnpify/lib`).patchFs();

const {makeConfig} = require(`@berry/builder/lib/tools/makeConfig`);

module.exports = makeConfig({
  context: __dirname,

  mode: `production`,
  optimization: {
    minimize: false
  },

  entry: {
    [`index`]: `./sources/index.ts`,
    [`microkernel`]: `./sources/microkernel.ts`,
  },

  output: {
    filename: `[name].js`,
    path: `${__dirname}/lib`,
  },
});
