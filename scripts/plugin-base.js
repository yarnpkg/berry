const {existsSync} = require(`fs`);

module.exports = name => {
  if (existsSync(`${__dirname}/../packages/plugin-${name}/bundles/@yarnpkg/plugin-${name}.js`)) {
    return require(`${__dirname}/../packages/plugin-${name}/bundles/@yarnpkg/plugin-${name}.js`);
  } else {
    return require(`${__dirname}/../packages/plugin-${name}/bin/@yarnpkg/plugin-${name}.js`);
  }
};
