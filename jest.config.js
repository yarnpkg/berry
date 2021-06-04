module.exports = {
  testEnvironment: require.resolve(`jest-environment-node`),
  transformIgnorePatterns: [`${__dirname}/packages/yarnpkg-libzip/sources/libzip(Async|Sync).js$`, `/.pnp.cjs$`],
  modulePathIgnorePatterns: [
    `<rootDir>/packages/acceptance-tests`,
    `<rootDir>/packages/gatsby/.cache`,
    `<rootDir>/packages/plugin-compat`,
  ],
  reporters: [`default`, [require.resolve(`jest-junit`), {output: `<rootDir>/junit.xml`}]],
  setupFiles: [`@yarnpkg/cli/sources/polyfills.ts`],
  testTimeout: 50000,
};
