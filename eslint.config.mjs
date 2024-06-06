import eslintConfig from '@yarnpkg/eslint-config';
import reactEslintConfig from '@yarnpkg/eslint-config/react';

export default [
  ...eslintConfig,
  ...reactEslintConfig,

  {
    ignores: [
      `.yarn`,

      `packages/docusaurus/.docusaurus`,

      `packages/yarnpkg-pnp/sources/hook.js`,
      `packages/yarnpkg-pnp/sources/esm-loader/built-loader.js`,

      `packages/yarnpkg-libzip/sources/libzipAsync.js`,
      `packages/yarnpkg-libzip/sources/libzipSync.js`,

      // The parsers are auto-generated
      `packages/yarnpkg-parsers/sources/grammars/*.js`,

      `packages/yarnpkg-core/sources/worker-zip/index.js`,
      `packages/yarnpkg-cli/bundles/yarn.js`,

      `packages/*/lib`,
      `packages/*/bin`,
      `packages/*/build`,
      `packages/**/*fixtures*`,
      `packages/yarnpkg-libzip/artifacts`,
      `packages/plugin-compat/extra/fsevents/fsevents-*.js`,

      // Minimize the diff with upstream`,
      `packages/yarnpkg-pnp/sources/node`,
      `packages/yarnpkg-pnp/sources/loader/node-options*`
    ],
  },

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
    languageOptions: {
      globals: {
        makeTemporaryEnv: `readonly`,
        makeTemporaryMonorepoEnv: `readonly`,
      },
    },
  },

  {
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
  },
];
