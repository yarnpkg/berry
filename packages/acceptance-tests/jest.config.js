module.exports = {
  resolver: require.resolve(`jest-pnp-resolver`),
  testEnvironment: require.resolve(`jest-environment-node`),
  modulePathIgnorePatterns: [`<rootDir>/pkg-tests-fixtures/packages/`],
  setupTestFrameworkScriptFile: require.resolve(`./berry.setup.js`),
  reporters: [`default`, require.resolve(`jest-junit`)],
};
