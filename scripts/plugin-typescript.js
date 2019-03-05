const {existsSync} = require(`fs`);

if (existsSync(`${__dirname}/../packages/plugin-typescript/bundles/@berry/plugin-typescript.js`)) {
  module.exports = require(`${__dirname}/../packages/plugin-typescript/bundles/@berry/plugin-typescript.js`);
} else {
  module.exports = require(`${__dirname}/../packages/plugin-typescript/bin/@berry/plugin-typescript.js`);
}
