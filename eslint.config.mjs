import reactEslintConfig from '@yarnpkg/eslint-config/react';
import eslintConfig      from '@yarnpkg/eslint-config';

// eslint-disable-next-line arca/no-default-export
export default [
  {
    ignores: [
      `**/coverage/**`,
      `**/__snapshots__/**`,
      `.yarn`,
      `.pnp.cjs`,
      `.pnp.loader.mjs`,

      // Pre-compiled binaries
      `packages/*/lib`,
      `packages/*/bin`,
      `packages/*/build`,
      `packages/*/bundles`,

      // Test fixtures
      `packages/**/*fixtures*`,

      // Generated files for website
      `packages/docusaurus/.docusaurus`,

      // Generated compressed worker
      `packages/yarnpkg-core/sources/worker-zip/index.js`,

      // Build output for libui
      `packages/yarnpkg-libui/sources/**/*.js`,
      `packages/yarnpkg-libui/sources/**/*.d.ts`,

      // Pre-compiled from C sources
      `packages/yarnpkg-libzip/sources/libzipAsync.js`,
      `packages/yarnpkg-libzip/sources/libzipSync.js`,
      // The C sources themselves
      `packages/yarnpkg-libzip/artifacts`,

      // Generated compressed hooks
      `packages/yarnpkg-pnp/sources/hook.js`,
      `packages/yarnpkg-pnp/sources/esm-loader/built-loader.js`,
      // Minimize the diff with upstream
      `packages/yarnpkg-pnp/sources/node`,
      `packages/yarnpkg-pnp/sources/loader/node-options*`,

      // Generated PEG.js grammars
      `packages/yarnpkg-parsers/sources/grammars/*.js`,

      // Patched fsevents
      `packages/plugin-compat/extra/fsevents/fsevents-*.js`,
    ],
  },

  ...eslintConfig,
  ...reactEslintConfig,

  {
    name: `berry/naming-convention`,
    files: [`**/*.ts`, `**/*.cts`, `**/*.mts`, `**/*.tsx`],
    ignores: [`packages/*/sources/{index,Plugin}.ts`],
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
    name: `berry/env/acceptance-tests`,
    files: [`packages/acceptance-tests/pkg-tests-specs/**/*.test.{js,ts}`],
    languageOptions: {
      globals: {
        makeTemporaryEnv: `readonly`,
        makeTemporaryMonorepoEnv: `readonly`,
      },
    },
  },

  {
    name: `berry/rules`,
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
