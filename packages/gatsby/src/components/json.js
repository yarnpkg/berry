import React from 'react';

import {
  Container,
  Main,

  ArrayProperty,
  DictionaryProperty,
  ScalarProperty,

  Scalar,
} from './syntax';

const theme = {
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

export const JsonContainer = props => {
  return <Container {... props} theme={theme} />;
};

export const JsonMain = props => {
  return <Main {... props} theme={theme} />;
};

export const JsonArrayProperty = props => {
  return <ArrayProperty {... props} theme={theme} />;
};

export const JsonObjectProperty = props => {
  return <DictionaryProperty {... props} theme={theme} />;
};

export const JsonScalarProperty = props => {
  return <ScalarProperty {... props} theme={theme} />;
};

export const JsonScalar = props => {
  return <Scalar {... props} theme={theme} />;
};
