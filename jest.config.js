module.exports = {
  resolver: require.resolve(`jest-pnp-resolver`),
  testEnvironment: require.resolve(`jest-environment-node`),
  transformIgnorePatterns: [`packages/berry-libzip/sources/libzip.js`],
  modulePathIgnorePatterns: [`<rootDir>/packages/acceptance-tests`],
  reporters: [`default`, require.resolve(`jest-junit`)],
};
