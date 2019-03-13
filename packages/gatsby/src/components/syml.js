import {css}  from '@emotion/core';
import styled from '@emotion/styled';
import React  from 'react';

export const SymlContainer = styled.div`
  padding: 2em;

  font-family: "PT Mono";

  background: #3f3f3f;
  color: #ddddcc;

  code {
    font-family: "PT Mono";

    color: #639db1;
  }
`;

export const symlKey = css`
  color: #dfc47d;
`;

export const stringValue = css`
  color: #cc9393;
`;

export const booleanValue = css`
  color: #eddd3d;
`;

export const SymlDescription = styled.div`
  margin-top: 1em;
  margin-bottom: 0.5em;

  font-family: "Open Sans";

  &:first-of-type {
    margin-top: 0;
  }
`;

export const SymlDescribe = ({description, children}) => <>
  {description && <SymlDescription>
    {description}
  </SymlDescription>}
  {children}
</>;

export const SymlStringProperty = ({name, placeholder, description}) => <>
  <SymlDescribe description={description}>
    <div>
      <span css={symlKey}>{name}</span>: <span css={stringValue}>{JSON.stringify(placeholder)}</span>
    </div>
  </SymlDescribe>
</>;

export const SymlBooleanProperty = ({name, placeholder, description}) => <>
  <SymlDescribe description={description}>
    <div>
      <span css={symlKey}>{name}</span>: <span css={booleanValue}>{placeholder}</span>
    </div>
  </SymlDescribe>
</>;
