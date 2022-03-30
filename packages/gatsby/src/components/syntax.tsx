import {css}                                  from '@emotion/react';
import styled, {StyledComponent}              from '@emotion/styled';
import {FaLink}                               from 'react-icons/fa';
import React, {PropsWithChildren, useContext} from 'react';

import {ifMobile}                             from './responsive';

export type Theme = {
  name: string;

  colors: {
    background: string;
    documentation: string;
    highlight: string;
    code: string;
    key: string;
    string: string;
    boolean: string;
    number: string;
  };

  formatKey: (value: unknown) => string;
  formatValue: (value: unknown) => string;

  keys: {
    suffix: string;
  };

  dictionaries: {
    leading: string;
    trailing: string;
    suffix: string;
  };

  arrays: {
    leading: string;
    trailing: string;
    prefix: string;
    suffix: string;
  };
};

export type ThemeProps = {
  theme: Theme;
};

const getColorForScalar = (theme: Theme, scalar: unknown) => {
  if (typeof scalar === `string`)
    return theme.colors.string;

  if (typeof scalar === `boolean`)
    return theme.colors.boolean;

  if (typeof scalar === `number`)
    return theme.colors.number;

  return null;
};

export const Container = styled.article<ThemeProps>`
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
  overflow-wrap: break-word;

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

const DescriptionAnchor = styled.div<ThemeProps>`
  margin-top: -2.5em;

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

  ${ifMobile} {
    padding: 1em 0;
  }

  &:first-of-type {
    margin-top: 0;
  }

  & + div {
    margin-top: -0.5em;
  }

  span {
    white-space: normal;
    overflow-wrap: break-word;
  }
`;

const AnchorContainer = styled.a`
  margin-left: -0.5em;
  padding: 0.5em;

  color: inherit;
  text-decoration: none;
`;

const Description = styled.div`
  margin-bottom: 0.5em;

  font-family: "Open Sans", sans-serif;
  white-space: normal;
  overflow-wrap: break-word;
`;

const NestedSectionHeaderContext = React.createContext(1);

export type NestedSectionHeaderProps = {
  name?: string;
};

const NestedSectionHeader = ({name, children}: PropsWithChildren<NestedSectionHeaderProps>) => {
  const depth = useContext(NestedSectionHeaderContext);

  return <>
    {React.createElement(`h${depth}`, {style: {display: `none`}}, name)}
    <NestedSectionHeaderContext.Provider value={depth + 1}>
      {children}
    </NestedSectionHeaderContext.Provider>
  </>;
};

export type DescribeProps = ThemeProps & NestedSectionHeaderProps & {
  description: React.ReactNode | null;
  anchor?: string | null;
};

const Describe = ({theme, name, description, anchor, children}: PropsWithChildren<DescribeProps>) => description ? <>
  <DescriptionAnchor id={`${anchor}`} theme={theme}>
    <NestedSectionHeader name={name}>
      <DescriptionContainer theme={theme}>
        <Description theme={theme}>
          {description}
        </Description>
        {children}
      </DescriptionContainer>
    </NestedSectionHeader>
  </DescriptionAnchor>
</> : children as JSX.Element;

const Anchor = () => <>
  <span style={{fontSize: `0.7em`, whiteSpace: `nowrap`}}>
    <FaLink/>
  </span>
</>;

export type KeyProps = ThemeProps & NestedSectionHeaderProps & {
  anchorTarget?: string | null;
};

const Key = ({theme, name, anchorTarget}: KeyProps) => <>
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

export type ArrayProps = KeyProps & {
  suffix?: string;
};

export const Array = ({theme, name, suffix, anchorTarget, children}: PropsWithChildren<ArrayProps>) => <div>
  <div>{name && <><Key theme={theme} name={name} anchorTarget={anchorTarget} /></>}{theme.arrays.leading}</div>
  <div style={{position: `relative`, paddingLeft: `2em`, top: !(children as any).every((child: any) => child.type.BaseComponent === Scalar) ? `2em` : ``}}>
    {React.Children.map(children, (child, index) =>
      <div key={index} style={{display: `flex`}}>
        <div>{theme.arrays.prefix}</div>
        <div style={{width: `100%`}}>
          {React.cloneElement(child as JSX.Element, {suffix: theme.arrays.suffix})}
        </div>
      </div>,
    )}
  </div>
  <div>{theme.arrays.trailing}{suffix}</div>
</div>;

export type DictionaryProps = KeyProps & {
  suffix?: string;
  margin: boolean;
};

export const Dictionary = ({theme, name, suffix, anchorTarget, children, margin}: PropsWithChildren<DictionaryProps>) => <div>
  <div>{name && <><Key theme={theme} name={name} anchorTarget={anchorTarget} /></>}{theme.dictionaries.leading}</div>
  <div style={{paddingLeft: `2em`}} css={margin ? marginContainer : null} data-dictionaries-suffix={theme.dictionaries.suffix}>
    {React.Children.map(children, (child, index) =>
      <React.Fragment key={index}>
        {React.cloneElement(child as JSX.Element, {suffix: theme.dictionaries.suffix})}
      </React.Fragment>,
    )}
  </div>
  <div>{theme.dictionaries.trailing}{suffix}</div>
</div>;

export type ScalarProps = KeyProps & {
  suffix?: string;
  placeholder: unknown;
};

export const Scalar = ({theme, suffix, placeholder}: ScalarProps) => <div>
  <span style={{color: getColorForScalar(theme, placeholder) ?? undefined}}>{theme.formatValue(placeholder)}</span>{suffix}
</div>;

export type DictionaryPropertyProps = DescribeProps & DictionaryProps;

export const DictionaryProperty = ({theme, name, anchor = name, margin, description, children}: PropsWithChildren<DictionaryPropertyProps>) => <>
  <Describe theme={theme} name={name} description={description} anchor={description ? anchor : null}>
    <Dictionary theme={theme} name={name} margin={margin} anchorTarget={description ? anchor : null}>
      {children}
    </Dictionary>
  </Describe>
</>;

export type ArrayPropertyProps = DescribeProps;

export const ArrayProperty = ({theme, name, anchor = name, description, children}: PropsWithChildren<ArrayPropertyProps>) => <>
  <Describe theme={theme} name={name} description={description} anchor={description ? anchor : null}>
    <Array theme={theme} name={name} anchorTarget={description ? anchor : null}>
      {children}
    </Array>
  </Describe>
</>;

export type ScalarPropertyProps = DescribeProps & ScalarProps;

export const ScalarProperty = ({theme, name, anchor = name, placeholder, description}: ScalarPropertyProps) => <>
  <Describe theme={theme} name={name} description={description} anchor={description ? anchor : null}>
    <div style={{marginRight: `-2vw`}}>
      <Key theme={theme} name={name} anchorTarget={description ? anchor : null} /><span style={{color: getColorForScalar(theme, placeholder) ?? undefined}}>{theme.formatValue(placeholder)}</span>{theme.dictionaries.suffix}
    </div>
  </Describe>
</>;

export function themed<T extends ThemeProps>(BaseComponent: React.ComponentType<T> | StyledComponent<any, T, any>, theme: Theme) {
  const ThemedComponent = (props: T) => <BaseComponent {...props} theme={theme} />;

  ThemedComponent.BaseComponent = BaseComponent;
  ThemedComponent.displayName = `${theme.name}${BaseComponent.displayName ?? BaseComponent.name}`;

  return ThemedComponent;
}
