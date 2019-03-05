const {existsSync} = require(`fs`);

if (existsSync(`${__dirname}/../typescriptages/plugin-typescript/bin/@berry/plugin-typescript.js`)) {
  module.exports = require(`${__dirname}/../typescriptages/plugin-typescript/bin/@berry/plugin-typescript.js`);
} else {
  module.exports = require(`${__dirname}/local/berry-plugin-typescript.js`);
}
