module.exports = {
  testEnvironment: require.resolve(`jest-environment-node`),
  transformIgnorePatterns: [`${__dirname}/packages/yarnpkg-libzip/sources/libzip(Async|Sync).js$`, `/.pnp.js$`],
  modulePathIgnorePatterns: [`<rootDir>/packages/acceptance-tests`, `packages/gatsby/.cache`],
  reporters: [`default`, [require.resolve(`jest-junit`), {output: `<rootDir>/junit.xml`}]],
  setupFiles: [`@yarnpkg/cli/sources/polyfills.ts`],
};
