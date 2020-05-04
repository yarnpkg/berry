module.exports = {
  plugins: [
    `@typescript-eslint`,
  ],

  rules: {
    '@typescript-eslint/no-extra-non-null-assertion': 2,

    '@typescript-eslint/no-non-null-asserted-optional-chain': 2,

    'constructor-super': 2,

    'for-direction': 2,

    'getter-return': 2,

    'no-class-assign': 2,

    'no-const-assign': 2,

    'no-delete-var': 2,

    'no-dupe-args': 2,

    'no-dupe-class-members': 2,

    'no-dupe-else-if': 2,

    'no-dupe-keys': 2,

    'no-duplicate-case': 2,

    'no-ex-assign': 2,

    'no-extra-boolean-cast': 2,

    'no-func-assign': 2,

    'no-invalid-regexp': 2,

    'no-obj-calls': 2,

    'no-misleading-character-class': 2,

    'no-new-symbol': 2,

    'no-redeclare': 2,

    'no-self-assign': 2,

    'no-setter-return': 2,

    'no-shadow-restricted-names': 2,

    'no-this-before-super': 2,

    'no-unreachable': 2,

    'no-unexpected-multiline': 2,

    'no-undef': 2,

    'no-unsafe-finally': 2,

    'no-unsafe-negation': 2,

    'valid-typeof': 2,
  },

  overrides: [
    {
      files: [`*.test.{js,ts}`],
      env: {
        jest: true,
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
