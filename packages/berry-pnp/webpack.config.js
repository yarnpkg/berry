const path = require(`path`);

module.exports = {
  mode: `development`,
  target: `node`,
  context: __dirname,
  entry: `./sources/hook.js`,
  output: {
    filename: `hook.bundle.js`,
    path: path.resolve(__dirname, `lib`),
  }
};
