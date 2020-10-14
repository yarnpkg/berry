import styled                from '@emotion/styled';
import {Link}                from 'gatsby';
import React                 from 'react';

import useScroll             from '../utils/useScroll';

import {ifDesktop, ifMobile} from './responsive';

const Container = styled.div`
  position: relative;

  ${ifDesktop} {
    padding-left: 260px;
  }
`;

const Menu = styled.div`
  ${ifDesktop} {
    position: fixed;
    left: 0;

    width: 260px;
    height: calc(100vh - 6.5em);
    overflow-y: auto;

    padding-right: 4px;
    background: #d1dee8;
  }
  ${ifMobile} {
    display: flex;
    overflow-x: auto;
    padding-left: 1em;
    padding-right: 1em;
  }
`;

const MenuEntry = styled(Link)`
  display: flex;
  align-items: center;

  text-decoration: none;

  color: #333333;
  background: #ffffff;

  ${ifDesktop} {
    padding: 1em;
    position: relative;

    &:first-of-type {
      border-top: 1px solid #cfdee9;
    }
    &:hover {
      background: hsl(204, 33%, 96%);
    }

    &::before {
      content: "";
      position: absolute;
      z-index: 1;
      top: 0;
      bottom: 0;
      left: 100%;
      width: 4px;
      background: transparent;
    }
    &:first-of-type::before {
      top: -1px;
    }
    &.active::before {
      background: #2188b6;
    }
  }
  ${ifMobile} {
    flex-direction: column;
    padding: .5em;
    white-space: pre;
    border-bottom: 4px solid transparent;
    &.active {
        border-bottom-color #2188b6;
      }
    }
  }
`;

const Tag = styled.code`
  color: #007aa2;

  font-family: "PT Mono";

  ${ifDesktop} {
    margin-left: auto;
  }

  font-size: 70%;
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
        {items.map(({to, name, tag}) => <React.Fragment key={name}>
          <MenuEntry to={to} activeClassName={`active`}>
            {name.match(/^`.*`$/) ? <code>{name.slice(1, -1)}</code> : name}
            {tag ? <Tag>{tag}</Tag> : null}
          </MenuEntry>
        </React.Fragment>)}
      </Menu>
      <Content>
        {children}
      </Content>
    </Container>
  </>;
};
