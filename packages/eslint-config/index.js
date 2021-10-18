// Workaround for https://github.com/eslint/eslint/issues/3458
require(`@rushstack/eslint-patch/modern-module-resolution`);

module.exports = {
  extends: [
    `./rules/best-practices`,
    `./rules/errors`,
    `./rules/style`,
    `./rules/typescript`,
  ].map(require.resolve),

  parser: require.resolve(`@typescript-eslint/parser`),

  env: {
    node: true,
    es2017: true,
  },

  parserOptions: {
    ecmaVersion: 2019,
    sourceType: `module`,
    ecmaFeatures: {
      modules: true,
    },
  },
};
