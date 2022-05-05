// plugin-compat is tested separately, as it relies on external resources
// and it takes a long time for them to be fetched

module.exports = Object.assign({}, require(`@yarnpkg/monorepo/jest.config.js`), {
  modulePathIgnorePatterns: [],
});
