import styled      from '@emotion/styled';
import {Link}      from 'gatsby';
import React       from 'react';

import useScroll   from '../utils/useScroll';

import {ifDesktop} from './responsive';

const Container = styled.div`
  position: relative;

  ${ifDesktop} {
    padding-left: 300px;
  }
`;

const Menu = styled.div`
  ${ifDesktop} {
    position: fixed;
    left: 0;

    width: 260px;
    height: calc(100vh - 6.5em);
    overflow-y: auto;

    padding-right: 3px;
    background: #d1dee8;
  }
`;

const MenuEntry = styled(Link)`
  display: flex;
  align-items: center;

  padding: 1em;

  text-decoration: none;

  color: #333333;
  background: #ffffff;

  ${ifDesktop} {
    &:hover {
      background: hsl(204, 33%, 96%);
    }
  }

  border: 4px solid transparent;
  &.active {
    border-right-color #2188b6;
  }
`;

const Content = styled.div`
  & > * {
    overflow: auto;
  }
`;

export const Navigation = ({items, children}) => {
  const scrollRef = useScroll();

  return <>
    <Container>
      <Menu ref={scrollRef}>
        {items.map(({to, name}) => <React.Fragment key={name}>
          <MenuEntry to={to} activeClassName={`active`}>
            {name.match(/^`.*`$/) ? <code>{name.slice(1, -1)}</code> : name}
          </MenuEntry>
        </React.Fragment>)}
      </Menu>
      <Content>
        {children}
      </Content>
    </Container>
  </>;
};
