import stylisticJsxEslint from '@stylistic/eslint-plugin-jsx';
import stylisticEslint    from '@stylistic/eslint-plugin';
import typescriptEslint   from '@typescript-eslint/eslint-plugin';
import arcaEslint         from 'eslint-plugin-arca';

// eslint-disable-next-line arca/no-default-export
export default [
  {
    name: `@yarnpkg/configs/style`,

    plugins: {
      [`arca`]: arcaEslint,
      [`@typescript-eslint`]: typescriptEslint,
      [`@stylistic`]: stylisticEslint,
      [`@stylistic-jsx`]: stylisticJsxEslint,
    },

    rules: {
      '@typescript-eslint/array-type': [`error`, {
        default: `generic`,
      }],

      '@stylistic/brace-style': 2,

      '@stylistic/comma-dangle': [`error`, `always-multiline`],

      '@stylistic/keyword-spacing': 2,

      '@stylistic/comma-spacing': 2,

      '@stylistic/function-call-spacing': 2,

      '@stylistic/indent': [`error`, 2, {
        SwitchCase: 1,
        ignoredNodes: [`TSTypeParameterInstantiation`],
      }],

      '@stylistic/member-delimiter-style': [`error`, {
        multiline: {
          delimiter: `semi`,
          requireLast: true,
        },
        singleline: {
          requireLast: false,
        },
        overrides: {
          interface: {
            singleline: {
              delimiter: `semi`,
            },
          },
          typeLiteral: {
            singleline: {
              delimiter: `comma`,
            },
          },
        },
      }],

      '@stylistic/quotes': [`error`, `backtick`],

      '@stylistic/semi': 2,

      '@stylistic/space-infix-ops': 2,

      '@stylistic/type-annotation-spacing': 2,

      'arca/import-quotes': 2,

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

      '@stylistic/array-bracket-spacing': 2,

      '@stylistic/arrow-parens': [`error`, `as-needed`],

      '@stylistic/arrow-spacing': 2,

      '@stylistic/computed-property-spacing': 2,

      '@stylistic/eol-last': [`error`, `always`],

      '@stylistic/generator-star-spacing': [`error`, {
        before: true,
        after: true,
      }],

      '@stylistic/jsx-quotes': 2,

      '@stylistic/key-spacing': 2,

      '@stylistic/no-extra-semi': 2,

      'no-irregular-whitespace': 2,

      '@stylistic/no-mixed-spaces-and-tabs': 2,

      '@stylistic/no-multiple-empty-lines': [`error`, {max: 2, maxBOF: 0, maxEOF: 0}],

      '@stylistic/no-tabs': 2,

      '@stylistic/no-trailing-spaces': 2,

      '@stylistic/object-curly-spacing': 2,

      '@stylistic/padded-blocks': [`error`, `never`],

      '@stylistic/quote-props': [`error`, `as-needed`],

      '@stylistic/rest-spread-spacing': 2,

      '@stylistic/space-before-blocks': 2,

      '@stylistic/space-in-parens': 2,

      '@stylistic/template-curly-spacing': 2,
    },
  },
];
