import {css}  from '@emotion/core';
import styled from '@emotion/styled';
import React  from 'react';

export const JsonContainer = styled.div`
  padding: 2em;

  font-family: "PT Mono";

  background: #242424;
  color: #ddddcc;

  code {
    font-family: "PT Mono";

    color: #639db1;
  }
`;

export const marginContainer = css`
  & > :first-child {
    margin-top: 1em;
  }

  & > :last-child {
    margin-bottom: 1em;
  }
`;

export const jsonKey = css`
  color: #8ac6f2;
`;

export const stringValue = css`
  color: #95e454;
`;

export const booleanValue = css`
  color: #f08080;
`;

export const JsonDescription = styled.div`
  margin-top: 1em;
  margin-bottom: 0.5em;

  font-family: "Open Sans";
`;

export const JsonDescribe = ({description, children}) => <>
  {description && <JsonDescription>
    {description}
  </JsonDescription>}
  {children}
</>;

export const JsonArray = ({name, children}) => <div>
  <div>{name && <><span css={jsonKey}>"{name}"</span>{`: `}</>}{`[`}</div>
  <div style={{paddingLeft: `2em`}}>
    {children}
  </div>
  <div>{name ? `],` : `]`}</div>
</div>;

export const JsonObject = ({name, children, margin}) => <div>
  <div>{name && <><span css={jsonKey}>"{name}"</span>{`: `}</>}{`{`}</div>
  <div style={{paddingLeft: `2em`}} css={margin ? marginContainer : null}>
    {children}
  </div>
  <div>{name ? `},` : `}`}</div>
</div>;

export const JsonString = ({placeholder}) => <div>
  <span css={stringValue}>{JSON.stringify(placeholder)}</span>,
</div>;

export const JsonObjectProperty = ({name, margin, description, children}) => <>
  <JsonDescribe description={description}>
    <JsonObject name={name} margin={margin}>
      {children}
    </JsonObject>
  </JsonDescribe>
</>;

export const JsonArrayProperty = ({name, description, children}) => <>
  <JsonDescribe description={description}>
    <JsonArray name={name}>
      {children}
    </JsonArray>
  </JsonDescribe>
</>;

export const JsonStringProperty = ({name, placeholder, description}) => <>
  <JsonDescribe description={description}>
    <div>
      <span css={jsonKey}>"{name}"</span>: <span css={stringValue}>{JSON.stringify(placeholder)}</span>,
    </div>
  </JsonDescribe>
</>;

export const JsonBooleanProperty = ({name, placeholder, description}) => <>
  <JsonDescribe description={description}>
    <div>
      <span css={jsonKey}>"{name}"</span>: <span css={booleanValue}>{placeholder}</span>,
    </div>
  </JsonDescribe>
</>;
