import styled                from '@emotion/styled';
import React                 from 'react';

import {Layout}              from './layout';
import {Navigation}          from './navigation';
import {ifMobile, ifDesktop} from './responsive';

const Container = styled.div`
  padding: 2em;
  ${ifMobile} {
    padding: 1em;
  }
  ${ifDesktop} {
    border-top: 1px solid #cfdee9;
  }
`;

export const LayoutContentNav = ({items, children}) => {
  return <>
    <Layout>
      <Navigation items={items}>
        <Container>
          <div style={{maxWidth: 900}}>
            {children}
          </div>
        </Container>
      </Navigation>
    </Layout>
  </>;
};
