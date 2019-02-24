module.exports = Object.assign({}, require(`@berry/monorepo/jest.config.js`), {
  modulePathIgnorePatterns: [`pkg-tests-fixtures`],
  setupFilesAfterEnv: [require.resolve(`./berry.setup.js`)],
});
