const {existsSync} = require(`fs`);

if (existsSync(`${__dirname}/../packages/berry-cli/bin/berry.js`)) {
  require(`${__dirname}/../packages/berry-cli/bin/berry.js`);
} else {
  require(`${__dirname}/local/berry.js`);
}
