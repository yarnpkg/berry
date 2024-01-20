module.exports = {
  plugins: [`@typescript-eslint`, `arca`],

  rules: {
    "@typescript-eslint/array-type": [
      `error`,
      {
        default: `generic`,
      },
    ],

    "@typescript-eslint/naming-convention": [
      `error`,
      {
        selector: `default`,
        format: [`camelCase`, `UPPER_CASE`, `PascalCase`],
        filter: {
          regex: `^(__.*|__non_webpack_require__|npm(_[a-z]+)+)$`,
          match: false,
        },
        leadingUnderscore: `allow`,
      },
    ],

    "@typescript-eslint/quotes": [`error`, `backtick`],

    "arca/import-ordering": [
      2,
      {
        hoistOneliners: true,
      },
    ],

    "arca/newline-after-import-section": [
      2,
      {
        enableOnelinerSections: true,
      },
    ],

    "no-irregular-whitespace": 2,
  },
};
