import styled                                              from '@emotion/styled';
import discordIcon                                         from '@iconify/icons-logos/discord';
import githubIcon                                          from '@iconify/icons-logos/github-icon';
import {InlineIcon}                                        from '@iconify/react';
import {Link, graphql, useStaticQuery, withPrefix}         from 'gatsby';
import PropTypes                                           from 'prop-types';
import React, {useLayoutEffect, useMemo, useRef, useState} from 'react';

import {Logo}                                              from './logo';
import {ifDesktop, ifMobile}                               from './responsive';

const HeaderContainer = styled.div`
  ${ifDesktop} {
    position: sticky;
    top: 0;
    z-index: 1;
    border-bottom: var(--header-border-bottom);
  }
`;

const NewsContainer = styled.div`
  position: relative;

  height: 40px;

  padding: 0 1em;

  text-decoration: none;
  line-height: 40px;

  ${ifMobile} {
    height: auto;

    white-space: pre-wrap;
    text-align: center;
  }

  background: #2188b6;
  color: rgba(255, 255, 255, 0.8);
`;

const NewsLine = styled.div`
  display: inline-block;
`;

const NewsOverlay = styled.a`
  position:absolute;

  left: 0;
  top: 0;
  bottom: 0;
  right: 0;
`;

const NewsInner = styled.div`
  position:relative;
  z-index: 1;

  pointer-events: none;

  a {
    display: inline-block;

    pointer-events: all;

    color: inherit;

    &:hover {
      color: #ffffff;
    }
  }
`;

const Highlight = styled.span`
  font-weight: bold;

  color: #ffffff;
`;

const MenuContainer = styled.header`
  background: #ffffff;

  ${ifDesktop} {
    display: flex;
  }
`;

const MenuTools = styled.div`
  display: flex;
`;

const MenuLogo = styled(Link)`
  display: flex;
  align-items: center;

  padding: 0 1em;

  ${ifDesktop} {
    &:hover {
      background: hsl(204, 33%, 96%);
    }
  }

  ${ifMobile} {
    margin-right: auto;

    padding: 1em;
  }
`;

const MenuToggle = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;

  margin: 1em;
  margin-left: 0;

  color: grey;
  border: 1px solid lightgrey;
  border-radius: 10px;

  width: 3em;
  height: 3em;

  font-size: inherit;

  background: #ffffff;

  ${ifDesktop} {
    display: none;
  }
`;

const MenuNavigation = styled.div`
  background: #ffffff;

  ${ifDesktop} {
    display: flex;
  }

  ${ifMobile} {
    position: absolute;
    z-index: 2;

    width: 100%;

    transform: scaleY(0);
    transform-origin: top left;
    transition: transform .3s;

    &.expanded {
      transform: scaleY(1);
      box-shadow: 0px 6px 6px 0px rgba(0, 0, 0, 0.1);
    }
  }
`;

const MenuSearchBox = styled.div`
  display: none;

  margin-left: auto;
  margin-right: 0;

  flex: 1;

  padding: 0 1em;

  ${props => props.onlyIf()} {
    display: flex;
  }

  ${ifMobile} {
    width: 100%;
  }

  > * {
    display: flex;

    margin: auto 0.5em;
  }

  > :first-child {
    margin-left: auto;
  }

  > :last-child {
    margin-right: 0;
  }

  .algolia-autocomplete {
    display: flex !important;

    flex: 1;
  }

  .docsearch-desktop, .docsearch-mobile {
    margin-left: auto;
    margin-right: 0;

    width: 100%;
    max-width: 300px;
    height: 3em;

    border: 1px solid lightgrey;

    padding: 0 1em;

    font-size: 1em;
  }
`;

const SearchParent = styled.div`
  flex: 1;
`;

const MenuEntry = styled.div`
  ${ifDesktop} {
    &:hover {
      background: hsl(204, 33%, 96%);
    }
  }
  a {
    display: flex;
    align-items: center;

    height: 60px;

    border: 4px solid transparent;

    padding: 0 1em;

    font-size: 0.9em;
    text-decoration: none;
    text-transform: uppercase;

    color: #000000;

    ${ifDesktop} {
      &.active {
        border-bottom-color: #2188b6;
        font-weight: 600;
        color: rgb(0, 122, 162);
      }
    }

    ${ifMobile} {
      width: 100%;
    }
  }
`;

const isActive = ({href, location}) => {
  const homeUrl = withPrefix(`/`);
  const packageInfoUrl = withPrefix(`/package/`);

  // Make all menu links (except home) active when itself or deeper routes are be current
  const isMenuLinkActive = href !== homeUrl && location.pathname.startsWith(href);

  // Make home menu active when home or package info routes are current
  const isHomeMenuLinkActive = href === homeUrl
      && [homeUrl, packageInfoUrl].includes(location.pathname);

  return isMenuLinkActive || isHomeMenuLinkActive ? {className: `active`} : null;
};

const SearchContainer = ({className}) => {
  const el = useMemo(() => {
    if (typeof document === `undefined`) return undefined;
    const input = document.createElement(`input`);
    input.className = className;
    input.placeholder = `Search the documentation`;
    return input;
  }, []);

  const ref = useRef(null);

  useLayoutEffect(() => {
    if (ref.current === null) return;
    ref.current.appendChild(el);
  }, [ref.current]);

  return <SearchParent ref={ref} />;
};


export const Header = ({children}) => {
  const data = useStaticQuery(graphql`
    query SiteQuery {
      site {
        siteMetadata {
          menuLinks {
            name
            link
          }
        }
      }
    }
  `);

  const [
    expanded,
    setExpanded,
  ] = useState(false);

  return <>
    <HeaderContainer>
      <NewsContainer>
        <NewsOverlay href={`https://classic.yarnpkg.com`}/>
        <NewsInner>
          <NewsLine><Highlight>Important:</Highlight> This documentation covers modern versions of Yarn.</NewsLine> <NewsLine>For 1.x docs, see classic.yarnpkg.com.</NewsLine>
        </NewsInner>
      </NewsContainer>

      <MenuContainer>
        <MenuTools>
          <MenuLogo to={`/`}>
            <Logo height={`3em`} align={`middle`} />
          </MenuLogo>
          <MenuSearchBox onlyIf={ifMobile}>
            <SearchContainer className={`docsearch-mobile`} />
          </MenuSearchBox>
          <MenuToggle onClick={() => setExpanded(!expanded)}>
            {expanded ? `×` : `≡`}
          </MenuToggle>
        </MenuTools>

        <MenuNavigation className={expanded ? `expanded` : ``}>
          {data.site.siteMetadata.menuLinks.map(({name, link}) => <React.Fragment key={name}>
            <MenuEntry>
              <Link to={link} activeClassName={`active`} getProps={isActive}>
                {name}
              </Link>
            </MenuEntry>
          </React.Fragment>)}
        </MenuNavigation>

        <MenuSearchBox onlyIf={ifDesktop}>
          <SearchContainer className={`docsearch-desktop`} />
          <a href={`https://github.com/yarnpkg/berry`}>
            <InlineIcon icon={githubIcon} height={25}/>
          </a>
          <a href={`https://discord.com/invite/yarnpkg`}>
            <InlineIcon icon={discordIcon} height={25}/>
          </a>
        </MenuSearchBox>
      </MenuContainer>
      {children}
    </HeaderContainer>
  </>;
};

Header.propTypes = {
  siteTitle: PropTypes.string,
};

Header.defaultProps = {
  siteTitle: ``,
};
