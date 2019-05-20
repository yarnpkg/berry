import React  from 'react';

import {
  Container,

  ArrayProperty,
  BooleanProperty,
  ObjectProperty,
  StringProperty,

  String,
} from './syntax';

export const JsonContainer = props => {
  return <Container {... props} />;
};

export const JsonArrayProperty = props => {
  return <ArrayProperty {... props} />;
};

export const JsonBooleanProperty = props => {
  return <BooleanProperty {... props} />;
};

export const JsonObjectProperty = props => {
  return <ObjectProperty {... props} />;
};

export const JsonStringProperty = props => {
  return <StringProperty {... props} />;
};

export const JsonString = props => {
  return <String {... props} />;
};
