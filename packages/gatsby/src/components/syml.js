import {css}  from '@emotion/core';
import styled from '@emotion/styled';
import React  from 'react';

export const SymlContainer = styled.div`
  padding: 1.5em;

  font-family: "PT Mono";
  line-height: 1.6em;

  background: #3f3f3f;
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

export const symlKey = css`
  color: #dfc47d;
`;

export const stringValue = css`
  color: #cc9393;
`;

export const booleanValue = css`
  color: #eddd3d;
`;

export const SymlDescriptionContainer = styled.div`
  padding: 1em;

  &:first-of-type {
    margin-top: 0;
  }

  &:target {
    background: #716f6f;
  }

  & + div {
    margin-top: -0.5em;
  }
`;

export const SymlDescription = styled.div`
  margin-top: 1em;
  margin-bottom: 0.5em;

  font-family: "Open Sans";
  white-space: normal;

  &:first-of-type {
    margin-top: 0;
  }
`;

export const SymlKey = ({name, anchorTarget}) => <>
  <a css={symlKey} href={anchorTarget ? `#${anchorTarget}` : null}>{name}</a>
</>;

export const SymlDescribe = ({description, anchor, children}) => description ? <>
  <SymlDescriptionContainer id={`${anchor}`}>
    {<SymlDescription>
      {description}
    </SymlDescription>}
    {children}
  </SymlDescriptionContainer>
</> : children;

export const SymlStringProperty = ({name, placeholder, description}) => <>
  <SymlDescribe description={description} anchor={name}>
    <div>
      <SymlKey name={name} anchorTarget={description ? name : null} />: <span css={stringValue}>{JSON.stringify(placeholder)}</span>
    </div>
  </SymlDescribe>
</>;

export const SymlBooleanProperty = ({name, placeholder, description}) => <>
  <SymlDescribe description={description} anchor={name}>
    <div>
    <SymlKey name={name} anchorTarget={description ? name : null} />: <span css={booleanValue}>{placeholder}</span>
    </div>
  </SymlDescribe>
</>;
