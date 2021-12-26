module.exports = {
  extends: [
    require.resolve(`@yarnpkg/eslint-config`),
    require.resolve(`@yarnpkg/eslint-config/react`),
  ],
  overrides: [
    {
      files: [`!packages/*/sources/{index,Plugin}.ts`],
      rules: {
        '@typescript-eslint/naming-convention': [`error`, {
          selector: `typeLike`,
          format: [`PascalCase`],
          custom: {
            regex: `^Hooks$`,
            match: false,
          },
        }],
      },
    },
    {
      files: [`packages/acceptance-tests/pkg-tests-specs/**/*.test.{js,ts}`],
      globals: {
        makeTemporaryEnv: `readonly`,
      },
    },
  ],
};
