import tsParser      from '@typescript-eslint/parser';
import globals       from 'globals';

import bestPractices from './rules/best-practices.js';
import errors        from './rules/errors.js';
import style         from './rules/style.js';
import typescript    from './rules/typescript.js';

// eslint-disable-next-line arca/no-default-export
export default [
  {
    name: `@yarnpkg/setup`,
    languageOptions: {
      parser: tsParser,
      sourceType: `module`,
    },
  },
  {
    name: `@yarnpkg/env`,
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
  },
  {
    name: `@yarnpkg/env/tests`,
    files: [`**/*.test.*`],
    ignores: [`**/__snapshots__/**`],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },

  ...bestPractices,
  ...errors,
  ...style,
  ...typescript,
];
