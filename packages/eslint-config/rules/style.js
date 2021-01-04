module.exports = {
  plugins: [
    `@typescript-eslint`,
    `arca`,
  ],

  rules: {
    '@typescript-eslint/array-type': [`error`, {
      default: `generic`,
    }],

    '@typescript-eslint/brace-style': 2,

    '@typescript-eslint/comma-dangle': [`error`, `always-multiline`],

    '@typescript-eslint/keyword-spacing': 2,

    '@typescript-eslint/comma-spacing': 2,

    '@typescript-eslint/naming-convention': [`error`, {
      selector: `default`,
      format: [`camelCase`, `UPPER_CASE`, `PascalCase`],
      filter: {
        regex: `^(__.*|__non_webpack_module__|__non_webpack_require__|npm(_[a-z]+)+)$`,
        match: false,
      },
      leadingUnderscore: `allow`,
    }],

    '@typescript-eslint/func-call-spacing': 2,

    '@typescript-eslint/indent': [`error`, 2, {
      SwitchCase: 1,
      ignoredNodes: [`TSTypeParameterInstantiation`],
    }],

    '@typescript-eslint/quotes': [`error`, `backtick`],

    '@typescript-eslint/semi': 2,

    '@typescript-eslint/space-infix-ops': 2,

    '@typescript-eslint/type-annotation-spacing': 2,

    'arca/curly': 2,

    'arca/import-align': [2, {
      collapseExtraSpaces: true,
    }],

    'arca/import-ordering': [2, {
      hoistOneliners: true,
    }],

    'arca/newline-after-import-section': [2, {
      enableOnelinerSections: true,
    }],

    'array-bracket-spacing': 2,

    'arrow-parens': [`error`, `as-needed`],

    'arrow-spacing': 2,

    'computed-property-spacing': 2,

    'eol-last': [`error`, `always`],

    'generator-star-spacing': [`error`, {
      before: true,
      after: true,
    }],

    'jsx-quotes': 2,

    'key-spacing': 2,

    'no-extra-semi': 2,

    'no-irregular-whitespace': 2,

    'no-mixed-spaces-and-tabs': 2,

    'no-multiple-empty-lines': [`error`, {max: 2, maxBOF: 0, maxEOF: 0}],

    'no-tabs': 2,

    'no-trailing-spaces': 2,

    'object-curly-spacing': 2,

    'padded-blocks': [`error`, `never`],

    'quote-props': [`error`, `as-needed`],

    'rest-spread-spacing': 2,

    'space-before-blocks': 2,

    'space-in-parens': 2,

    'template-curly-spacing': 2,
  },
};
