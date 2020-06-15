import {css}    from '@emotion/core';
import styled   from '@emotion/styled';
import {FaLink} from 'react-icons/fa';
import React    from 'react';

const getColorForScalar = (theme, scalar) => {
  if (typeof scalar === `string`)
    return theme.colors.string;
  if (typeof scalar === `boolean`)
    return theme.colors.boolean;
  if (typeof scalar === `number`)
    return theme.colors.number;
  return null;
};

export const Container = styled.div`
  padding: 1.5em;

  font-family: "PT Mono", monospace;
  line-height: 1.6em;

  background: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.documentation};

  code {
    font-family: "PT Mono", monospace;

    color: ${props => props.theme.colors.code};
  }

  &, span {
    white-space: nowrap;
  }
`;

export const Main = styled.div`
  border: 1px solid;

  padding: 1em;

  font-family: "Open Sans", sans-serif;
  white-space: normal;

  & + * {
    margin-top: 0 !important;
  }

  p {
    margin-top: 0;
  }

  p:last-of-type {
    margin-bottom: 0;
  }
`;

const marginContainer = css`
  & > :first-of-type {
    margin-top: -1.5em;
  }

  & > :last-of-type {
    margin-bottom: -1.5em;
  }

  &[data-dictionaries-suffix=""] > :last-child {
    margin-bottom: -2.5em;
  }
`;

const DescriptionAnchor = styled.div`
  margin-top: -3em;

  padding: 1.5em 0;

  p {
    margin-top: 0;
  }

  p:last-of-type {
    margin-bottom: 0;
  }

  &:target > div {
    background: ${props => props.theme.colors.highlight};
  }
`;

const DescriptionContainer = styled.div`
  padding: 1em;

  &:first-of-type {
    margin-top: 0;
  }

  & + div {
    margin-top: -0.5em;
  }
`;

const AnchorContainer = styled.a`
  margin-left: -15px;

  padding: 15px;

  color: inherit;
  text-decoration: none;
`;

const Description = styled.div`
  margin-bottom: 0.5em;

  font-family: "Open Sans", sans-serif;
  white-space: normal;
`;

const Describe = ({theme, description, anchor, children}) => description ? <>
  <DescriptionAnchor id={`${anchor}`} theme={theme}>
    <DescriptionContainer theme={theme}>
      {<Description theme={theme}>
        {description}
      </Description>}
      {children}
    </DescriptionContainer>
  </DescriptionAnchor>
</> : children;

const Anchor = () => <>
  <span style={{fontSize: `0.7em`}}>
    <FaLink/>
  </span>
</>;

const Key = ({theme, name, anchorTarget}) => <>
  <span style={{color: theme.colors.key}}>
    {anchorTarget ? <>
      <AnchorContainer href={`#${anchorTarget}`}>
        <Anchor/>
      </AnchorContainer>{theme.formatKey(name)}
    </> : <>
      {theme.formatKey(name)}
    </>}
  </span>
  {theme.keys.suffix}
</>;

export const Array = ({theme, name, suffix, anchorTarget, children}) => <div>
  <div>{name && <><Key theme={theme} name={name} anchorTarget={anchorTarget} /></>}{theme.arrays.leading}</div>
  <div style={{paddingLeft: `2em`}}>
    {React.Children.map(children, child =>
      <div style={{display: `flex`}}>
        <div>{theme.arrays.prefix}</div>
        <div>
          {React.cloneElement(child, {suffix: theme.arrays.suffix})}
        </div>
      </div>
    )}
  </div>
  <div>{theme.arrays.trailing}{suffix}</div>
</div>;

export const Dictionary = ({theme, name, suffix, anchorTarget, children, margin}) => <div>
  <div>{name && <><Key theme={theme} name={name} anchorTarget={anchorTarget} /></>}{theme.dictionaries.leading}</div>
  <div style={{paddingLeft: `2em`}} css={margin ? marginContainer : null} data-dictionaries-suffix={theme.dictionaries.suffix}>
    {React.Children.map(children, child => <>
      {React.cloneElement(child, {suffix: theme.dictionaries.suffix})}
    </>)}
  </div>
  <div>{theme.dictionaries.trailing}{suffix}</div>
</div>;

export const Scalar = ({theme, suffix, placeholder}) => <div>
  <span style={{color: getColorForScalar(theme, placeholder)}}>{theme.formatValue(placeholder)}</span>{suffix}
</div>;

export const DictionaryProperty = ({theme, name, anchor = name, margin, description, children}) => <>
  <Describe theme={theme} description={description} anchor={description ? anchor : null}>
    <Dictionary theme={theme} name={name} margin={margin} anchorTarget={description ? anchor : null}>
      {children}
    </Dictionary>
  </Describe>
</>;

export const ArrayProperty = ({theme, name, anchor = name, description, children}) => <>
  <Describe theme={theme} description={description} anchor={description ? anchor : null}>
    <Array theme={theme} name={name} anchorTarget={description ? anchor : null}>
      {children}
    </Array>
  </Describe>
</>;

export const ScalarProperty = ({theme, name, anchor = name, placeholder, description}) => <>
  <Describe theme={theme} description={description} anchor={description ? anchor : null}>
    <div>
      <Key theme={theme} name={name} anchorTarget={description ? anchor : null} /><span style={{color: getColorForScalar(theme, placeholder)}}>{theme.formatValue(placeholder)}</span>{theme.dictionaries.suffix}
    </div>
  </Describe>
</>;
