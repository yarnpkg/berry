import typescriptEslint from '@typescript-eslint/eslint-plugin';

// eslint-disable-next-line arca/no-default-export
export default [
  {
    files: [`**/*.{ts,tsx}`],

    plugins: {
      [`@typescript-eslint`]: typescriptEslint,
    },

    rules: {
      // Checked by Typescript - ts(2378)
      'getter-return': 0,

      // Checked by Typescript - ts(2300)
      'no-dupe-args': 0,

      // Checked by Typescript - ts(1117)
      'no-dupe-keys': 0,

      // Checked by Typescript - ts(7027)
      'no-unreachable': 0,

      // Checked by Typescript - ts(2367)
      'valid-typeof': 0,

      // Checked by Typescript - ts(2588)
      'no-const-assign': 0,

      // Checked by Typescript - ts(2588)
      'no-new-symbol': 0,

      // Checked by Typescript - ts(2376)
      'no-this-before-super': 0,

      // This is checked by Typescript using the option `strictNullChecks`.
      'no-undef': 0,

      // Replaced by `@typescript-eslint/no-unused-vars`
      'no-unused-vars': 0,

      // This is already checked by Typescript.
      'no-dupe-class-members': `off`,

      // This is already checked by Typescript.
      'no-redeclare': `off`,
    },
  },
];
