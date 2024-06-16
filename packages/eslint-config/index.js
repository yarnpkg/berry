import tsParser      from '@typescript-eslint/parser';
import globals       from 'globals';

import bestPractices from './rules/best-practices.js';
import errors        from './rules/errors.js';
import style         from './rules/style.js';
import typescript    from './rules/typescript.js';

// eslint-disable-next-line arca/no-default-export
export default [
  ...bestPractices,
  ...errors,
  ...style,
  ...typescript,

  {
    languageOptions: {
      parser: tsParser,
      sourceType: `module`,
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
  },

  {
    files: [`**/*.test.*`],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
];
