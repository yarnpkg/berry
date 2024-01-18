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
        makeTemporaryMonorepoEnv: `readonly`,
      },
    },
  ],
  rules: {
    'no-restricted-properties': [2,
      {
        object: `semver`,
        property: `validRange`,
        message: `Use 'semverUtils.validRange' instead`,
      },
      {
        object: `semver`,
        property: `Range`,
        message: `Use 'semverUtils.validRange' instead`,
      },
    ],
    'no-restricted-globals': [2,
      {
        name: `fetch`,
        message: `Use 'httpUtils' instead`,
      },
    ],
    'no-restricted-imports': [
      `error`,
      {
        patterns: [
          {
            group: [`url`, `node:url`],
            importNames: [`URL`],
            message: `URL is a global, no need to import it`,
          },
        ],
      },
    ],
  },
};
