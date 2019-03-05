const {existsSync} = require(`fs`);

if (existsSync(`${__dirname}/../packages/plugin-pack/bundles/@berry/plugin-pack.js`)) {
  module.exports = require(`${__dirname}/../packages/plugin-pack/bundles/@berry/plugin-pack.js`);
} else {
  module.exports = require(`${__dirname}/../packages/plugin-pack/bin/@berry/plugin-pack.js`);
}
