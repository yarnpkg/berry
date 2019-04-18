import {css}  from '@emotion/core';
import styled from '@emotion/styled';
import React  from 'react';

export const JsonContainer = styled.div`
  padding: 1.5em;

  font-family: "PT Mono";
  line-height: 1.6em;

  background: #242424;
  color: #ddddcc;

  a[href^="#"] {
    border-bottom: 1px dotted #ddddcc;

    text-decoration: none;
  }

  code {
    font-family: "PT Mono";

    color: #639db1;
  }

  &, span {
    white-space: nowrap;
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

export const JsonDescriptionContainer = styled.div`
  padding: 1em;

  &:first-of-type {
    margin-top: 0;
  }

  &:target {
    background: #384973;
  }

  & + div {
    margin-top: -0.5em;
  }
`;

export const JsonDescription = styled.div`
  margin-bottom: 0.5em;

  font-family: "Open Sans";
  white-space: normal;
`;

export const JsonDescribe = ({description, anchor, children}) => description ? <>
  <JsonDescriptionContainer id={`${anchor}`}>
    {<JsonDescription>
      {description}
    </JsonDescription>}
    {children}
  </JsonDescriptionContainer>
</> : children;

export const JsonKey = ({name, anchorTarget}) => <>
  <a css={jsonKey} href={anchorTarget ? `#${anchorTarget}` : null}>"{name}"</a>
</>;

export const JsonArray = ({name, anchorTarget, children}) => <div>
  <div>{name && <><JsonKey name={name} anchorTarget={anchorTarget} />{`: `}</>}{`[`}</div>
  <div style={{paddingLeft: `2em`}}>
    {children}
  </div>
  <div>{name ? `],` : `]`}</div>
</div>;

export const JsonObject = ({name, anchorTarget, children, margin}) => <div>
  <div>{name && <><JsonKey name={name} anchorTarget={anchorTarget} />{`: `}</>}{`{`}</div>
  <div style={{paddingLeft: `2em`}} css={margin ? marginContainer : null}>
    {children}
  </div>
  <div>{name ? `},` : `}`}</div>
</div>;

export const JsonString = ({placeholder}) => <div>
  <span css={stringValue}>{JSON.stringify(placeholder)}</span>,
</div>;

export const JsonObjectProperty = ({name, margin, description, children}) => <>
  <JsonDescribe description={description} anchor={name}>
    <JsonObject name={name} margin={margin} anchorTarget={description ? name : null}>
      {children}
    </JsonObject>
  </JsonDescribe>
</>;

export const JsonArrayProperty = ({name, description, children}) => <>
  <JsonDescribe description={description} anchor={name}>
    <JsonArray name={name} anchorTarget={description ? name : null}>
      {children}
    </JsonArray>
  </JsonDescribe>
</>;

export const JsonStringProperty = ({name, placeholder, description}) => <>
  <JsonDescribe description={description} anchor={name}>
    <div>
      <JsonKey name={name} anchorTarget={description ? name : null} />: <span css={stringValue}>{JSON.stringify(placeholder)}</span>,
    </div>
  </JsonDescribe>
</>;

export const JsonBooleanProperty = ({name, placeholder, description}) => <>
  <JsonDescribe description={description} anchor={name}>
    <div>
      <JsonKey name={name} anchorTarget={description ? name : null} />: <span css={booleanValue}>{placeholder}</span>,
    </div>
  </JsonDescribe>
</>;
