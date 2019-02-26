module.exports = {
  resolver: require.resolve(`jest-pnp-resolver`),
  testEnvironment: require.resolve(`jest-environment-node`),
  transformIgnorePatterns: [`${__dirname}/packages/berry-libzip/sources/libzip.js$`, `/.pnp.js$`],
  modulePathIgnorePatterns: [`<rootDir>/packages/acceptance-tests`],
  reporters: [`default`, [require.resolve(`jest-junit`), {output: `<rootDir>/junit.xml`}]],
};
