import styled       from '@emotion/styled';
import React        from 'react';

import {Layout}     from './layout';
import {Navigation} from './navigation';

const Container = styled.div`
  padding: 2em;
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
