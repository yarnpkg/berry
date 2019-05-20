import {css}  from '@emotion/core';
import styled from '@emotion/styled';
import React  from 'react';

export const Container = styled.div`
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

const marginContainer = css`
  & > :first-child {
    margin-top: 1em;
  }

  & > :last-child {
    margin-bottom: 1em;
  }
`;

const key = css`
  color: #8ac6f2;
`;

const stringValue = css`
  color: #95e454;
`;

const booleanValue = css`
  color: #f08080;
`;

const DescriptionContainer = styled.div`
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

const Description = styled.div`
  margin-bottom: 0.5em;

  font-family: "Open Sans";
  white-space: normal;
`;

const Describe = ({description, anchor, children}) => description ? <>
  <DescriptionContainer id={`${anchor}`}>
    {<Description>
      {description}
    </Description>}
    {children}
  </DescriptionContainer>
</> : children;

const Key = ({name, anchorTarget}) => <>
  <a css={key} href={anchorTarget ? `#${anchorTarget}` : null}>"{name}"</a>
</>;

export const Array = ({name, anchorTarget, children}) => <div>
  <div>{name && <><Key name={name} anchorTarget={anchorTarget} />{`: `}</>}{`[`}</div>
  <div style={{paddingLeft: `2em`}}>
    {children}
  </div>
  <div>{name ? `],` : `]`}</div>
</div>;

export const Object = ({name, anchorTarget, children, margin}) => <div>
  <div>{name && <><Key name={name} anchorTarget={anchorTarget} />{`: `}</>}{`{`}</div>
  <div style={{paddingLeft: `2em`}} css={margin ? marginContainer : null}>
    {children}
  </div>
  <div>{name ? `},` : `}`}</div>
</div>;

export const String = ({placeholder}) => <div>
  <span css={stringValue}>{JSON.stringify(placeholder)}</span>,
</div>;

export const ObjectProperty = ({name, margin, description, children}) => <>
  <Describe description={description} anchor={name}>
    <Object name={name} margin={margin} anchorTarget={description ? name : null}>
      {children}
    </Object>
  </Describe>
</>;

export const ArrayProperty = ({name, description, children}) => <>
  <Describe description={description} anchor={name}>
    <Array name={name} anchorTarget={description ? name : null}>
      {children}
    </Array>
  </Describe>
</>;

export const StringProperty = ({name, placeholder, description}) => <>
  <Describe description={description} anchor={name}>
    <div>
      <Key name={name} anchorTarget={description ? name : null} />: <span css={stringValue}>{JSON.stringify(placeholder)}</span>,
    </div>
  </Describe>
</>;

export const BooleanProperty = ({name, placeholder, description}) => <>
  <Describe description={description} anchor={name}>
    <div>
      <Key name={name} anchorTarget={description ? name : null} />: <span css={booleanValue}>{placeholder}</span>,
    </div>
  </Describe>
</>;
