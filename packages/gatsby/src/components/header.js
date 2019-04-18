import styled                          from '@emotion/styled';
import {Link, graphql, useStaticQuery} from 'gatsby';
import PropTypes                       from 'prop-types';
import React, {useState}               from 'react';

import Logo                            from './logo';
import {ifDesktop, ifMobile}           from './responsive';

const HeaderContainer = styled.div`
  ${ifDesktop} {
    position: sticky;
    top: 0;
    z-index: 1;
  }
`;

const NewsContainer = styled.a`
  display: block;

  padding: 0.8em 1em;

  font-weight: light;
  text-decoration: none;

  background: #2188b6;
  color: rgba(255, 255, 255, 0.8);
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

  ${ifMobile} {
    margin-right: auto;

    padding: 1em;
  }
`;

const MenuToggle = styled.button`
  margin: 1em;
  margin-left: 0;

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
    z-index: 1;

    width: 100%;

    transform: scaleY(0);
    transform-origin: top left;
    transition: transform .3s;

    &.expanded {
      transform: scaleY(1);
    }
  }
`;

const MenuEntry = styled(Link)`
  display: flex;
  align-items: center;

  height: 4em;

  border: 3px solid transparent;

  padding: 0 1em;

  font-family: Abel;
  font-weight: light;
  text-decoration: none;
  text-transform: uppercase;

  color: #000000;

  ${ifDesktop} {
    &.active {
      border-bottom-color: #2188b6;
    }
  }

  ${ifMobile} {
    width: 100%;
  }
`;

const Header = () => {
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
      <NewsContainer href={`https://github.com/yarnpkg/berry`}>
        <Highlight>Important:</Highlight> This documentation covers the v2 onwards and is actively being worked on. Come help us!
      </NewsContainer>

      <MenuContainer>
        <MenuTools>
          <MenuLogo to={`/`}>
            <Logo height={`3em`} align={`middle`} />
          </MenuLogo>
          <MenuToggle onClick={() => setExpanded(!expanded)}>
            {`≡`}
          </MenuToggle>
        </MenuTools>

        <MenuNavigation className={expanded ? `expanded` : ``}>
          {data.site.siteMetadata.menuLinks.map(({name, link}) => <React.Fragment key={name}>
            <MenuEntry to={link} activeClassName={`active`} partiallyActive={link !== `/`}>
              {name}
            </MenuEntry>
          </React.Fragment>)}
        </MenuNavigation>
      </MenuContainer>
    </HeaderContainer>
  </>
};

Header.propTypes = {
  siteTitle: PropTypes.string,
};

Header.defaultProps = {
  siteTitle: ``,
};

export default Header;
