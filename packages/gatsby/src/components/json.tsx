import {
  Container,
  Main,

  ArrayProperty,
  DictionaryProperty,
  ScalarProperty,

  Dictionary,
  Scalar,

  Theme,

  themed,
} from './syntax';

const theme: Theme = {
  name: `Json`,

  colors: {
    background: `#242424`,
    documentation: `#ddddcc`,
    highlight: `#384973`,
    code: `#639db1`,
    key: `#8ac6f2`,
    string: `#95e454`,
    boolean: `#f08080`,
    number: `#ffd700`,
  },

  formatKey: key => {
    return JSON.stringify(key);
  },
  formatValue: value => {
    return JSON.stringify(value);
  },

  keys: {
    suffix: `: `,
  },

  dictionaries: {
    leading: `{`,
    trailing: `}`,
    suffix: `,`,
  },

  arrays: {
    leading: `[`,
    trailing: `]`,
    prefix: ``,
    suffix: `,`,
  },
};

export const JsonContainer = themed(Container, theme);

export const JsonMain = themed(Main, theme);

export const JsonArrayProperty = themed(ArrayProperty, theme);

export const JsonObjectProperty = themed(DictionaryProperty, theme);

export const JsonScalarProperty = themed(ScalarProperty, theme);

export const JsonDictionary = themed(Dictionary, theme);

export const JsonScalar = themed(Scalar, theme);
