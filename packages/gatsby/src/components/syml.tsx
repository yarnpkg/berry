import React from 'react';

import {
  Container,
  Main,

  ArrayProperty,
  DictionaryProperty,
  ScalarProperty,

  Scalar,

  Theme,
  ComponentPropsWithoutTheme,
} from './syntax';

const theme: Theme = {
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

export const SymlContainer = (props: ComponentPropsWithoutTheme<typeof Container>) => {
  return <Container {...props} theme={theme} />;
};

export const SymlMain = (props: ComponentPropsWithoutTheme<typeof Main>) => {
  return <Main {...props} theme={theme} />;
};

export const SymlArrayProperty = (props: ComponentPropsWithoutTheme<typeof ArrayProperty>) => {
  return <ArrayProperty {...props} theme={theme} />;
};

export const SymlObjectProperty = (props: ComponentPropsWithoutTheme<typeof DictionaryProperty>) => {
  return <DictionaryProperty {...props} theme={theme} />;
};

export const SymlScalarProperty = (props: ComponentPropsWithoutTheme<typeof ScalarProperty>) => {
  return <ScalarProperty {...props} theme={theme} />;
};

export const SymlScalar = (props: ComponentPropsWithoutTheme<typeof Scalar>) => {
  return <Scalar {...props} theme={theme} />;
};
