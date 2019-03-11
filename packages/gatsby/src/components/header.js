import {css}                        from '@emotion/core';
import styled                       from '@emotion/styled';
import {Link, StaticQuery, graphql} from 'gatsby';
import PropTypes                    from 'prop-types';
import React                        from 'react';

import Logo                         from './logo';

const NewsContainer = styled.header`
  padding: 0.8em 1em;

  font-weight: light;

  background: #2188b6;
  color: rgba(255, 255, 255, 0.8);
`;

const Highlight = styled.span`
  text-decoration: underline;

  color: #ffffff;
`;

const MenuContainer = styled.header`
  display: flex;

  background: #ffffff;
`;

const MenuLogo = styled(Link)`
  padding: 0.8em 1em;
`;

const MenuEntry = styled(Link)`
  display: flex;
  align-items: center;

  padding: 0.8em 1em;

  font-family: Abel;
  font-weight: light;
  text-decoration: none;
  text-transform: uppercase;

  color: #000000;

  &.active {
    border-bottom: 3px solid #2188b6;
  }
`;

const Header = ({siteTitle}) => (
  <StaticQuery
    query={graphql`
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
    `}
    render={data => <>
      <NewsContainer>
        <Highlight>Latest article:</Highlight> "Journey to the v2"
      </NewsContainer>

      <MenuContainer>
        <MenuLogo to={`/`}>
          <Logo height={`3em`} align={`middle`} />
        </MenuLogo>

        {data.site.siteMetadata.menuLinks.map(({name, link}) => <React.Fragment key={name}>
          <MenuEntry to={link} activeClassName={`active`} partiallyActive={link !== `/`}>
            {name}
          </MenuEntry>
        </React.Fragment >)}
      </MenuContainer>
    </>}
  />
);

Header.propTypes = {
  siteTitle: PropTypes.string,
};

Header.defaultProps = {
  siteTitle: ``,
};

export default Header;
