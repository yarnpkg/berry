module.exports = Object.assign({}, require(`@yarnpkg/monorepo/jest.config.js`), {
  modulePathIgnorePatterns: [`pkg-tests-fixtures`],
  setupFilesAfterEnv: [require.resolve(`./yarn.setup.ts`)],
});
