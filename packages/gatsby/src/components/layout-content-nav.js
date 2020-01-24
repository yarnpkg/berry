import styled       from '@emotion/styled';
import React        from 'react';

import {Layout}     from './layout';
import {Navigation} from './navigation';
import {ifDesktop}  from './responsive';

const Container = styled.div`
  padding: 2em;

  ${ifDesktop} {
    border-top: 1px solid #cfdee9;

    text-align: justify;
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
