module.exports = {
  testEnvironment: `node`,
  transformIgnorePatterns: [`${__dirname}/packages/yarnpkg-libzip/sources/libzip(Async|Sync).js$`, `/.pnp.cjs$`],
  modulePathIgnorePatterns: [
    `<rootDir>/packages/acceptance-tests`,
    `<rootDir>/packages/gatsby/.cache`,
    `<rootDir>/packages/plugin-compat`,
  ],
  setupFiles: [require.resolve(`@yarnpkg/cli/polyfills`)],
  testTimeout: 50000,
};
