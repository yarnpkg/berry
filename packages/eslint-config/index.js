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
    es6: true,
  },

  parserOptions: {
    ecmaVersion: 6,
    sourceType: `module`,
    ecmaFeatures: {
      modules: true,
    },
  },
};
