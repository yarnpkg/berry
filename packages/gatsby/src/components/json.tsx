import React from 'react';

import {
  Container,
  Main,

  ArrayProperty,
  DictionaryProperty,
  ScalarProperty,

  Dictionary,
  Scalar,

  Theme,
  ComponentPropsWithoutTheme,
} from './syntax';

const theme: Theme = {
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

export const JsonContainer = (props: ComponentPropsWithoutTheme<typeof Container>) => {
  return <Container {...props} theme={theme} />;
};

export const JsonMain = (props: ComponentPropsWithoutTheme<typeof Main>) => {
  return <Main {...props} theme={theme} />;
};

export const JsonArrayProperty = (props: ComponentPropsWithoutTheme<typeof ArrayProperty>) => {
  return <ArrayProperty {...props} theme={theme} />;
};

export const JsonObjectProperty = (props: ComponentPropsWithoutTheme<typeof DictionaryProperty>) => {
  return <DictionaryProperty {...props} theme={theme} />;
};

export const JsonScalarProperty = (props: ComponentPropsWithoutTheme<typeof ScalarProperty>) => {
  return <ScalarProperty {...props} theme={theme} />;
};

export const JsonDictionary = (props: ComponentPropsWithoutTheme<typeof Dictionary>) => {
  return <Dictionary {...props} theme={theme}/>;
};

export const JsonScalar = (props: ComponentPropsWithoutTheme<typeof Scalar>) => {
  return <Scalar {...props} theme={theme} />;
};
