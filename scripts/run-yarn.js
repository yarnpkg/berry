const {existsSync} = require(`fs`);

if (existsSync(`${__dirname}/../packages/berry-cli/bundles/berry.js`)) {
  require(`${__dirname}/../packages/berry-cli/bundles/berry.js`);
} else {
  require(`${__dirname}/../packages/berry-cli/bin/berry.js`);
}
