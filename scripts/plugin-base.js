const {existsSync} = require(`fs`);

module.exports = name => {
  if (existsSync(`${__dirname}/../packages/plugin-${name}/bundles/@berry/plugin-${name}.js`)) {
    return require(`${__dirname}/../packages/plugin-${name}/bundles/@berry/plugin-${name}.js`);
  } else {
    return require(`${__dirname}/../packages/plugin-${name}/bin/@berry/plugin-${name}.js`);
  }
};
