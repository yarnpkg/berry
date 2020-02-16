module.exports = Object.assign({}, require(`@yarnpkg/monorepo/jest.config.js`), {
  modulePathIgnorePatterns: [`pkg-tests-fixtures`],
  // this will limit the failures while I migrate all
  testRegex: '\\auth.test\\.js',
  setupFilesAfterEnv: [require.resolve(`./yarn.setup.ts`)],
});
