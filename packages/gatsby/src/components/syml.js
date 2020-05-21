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
    return key;
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

export const SymlContainer = props => {
  return <Container {... props} theme={theme} />;
};

export const SymlMain = props => {
  return <Main {... props} theme={theme} />;
};

export const SymlArrayProperty = props => {
  return <ArrayProperty {... props} theme={theme} />;
};

export const SymlObjectProperty = props => {
  return <DictionaryProperty {... props} theme={theme} />;
};

export const SymlScalarProperty = props => {
  return <ScalarProperty {... props} theme={theme} />;
};

export const SymlScalar = props => {
  return <Scalar {... props} theme={theme} />;
};
