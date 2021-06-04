import {
  Container,
  Main,

  ArrayProperty,
  DictionaryProperty,
  ScalarProperty,

  Scalar,

  Theme,
  Dictionary,

  themed,
} from './syntax';

const theme: Theme = {
  name: `Syml`,

  colors: {
    background: `#3f3f3f`,
    documentation: `#ddddcc`,
    highlight: `#716f6f`,
    code: `#639db1`,
    key: `#dfc47d`,
    string: `#cc9393`,
    boolean: `#eddd3d`,
    number: `#ffd700`,
  },

  formatKey: key => {
    return String(key);
  },
  formatValue: value => {
    return JSON.stringify(value);
  },

  keys: {
    suffix: `: `,
  },

  dictionaries: {
    leading: ``,
    trailing: ``,
    suffix: ``,
  },

  arrays: {
    leading: ``,
    trailing: ``,
    prefix: `-\u00a0`,
    suffix: ``,
  },
};

export const SymlContainer = themed(Container, theme);

export const SymlMain = themed(Main, theme);

export const SymlArrayProperty = themed(ArrayProperty, theme);

export const SymlObjectProperty = themed(DictionaryProperty, theme);

export const SymlScalarProperty = themed(ScalarProperty, theme);

export const SymlDictionary = themed(Dictionary, theme);

export const SymlScalar = themed(Scalar, theme);
