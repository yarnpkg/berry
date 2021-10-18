import styled                   from '@emotion/styled';
import React                    from 'react';

import {Toc}                    from '../components/toc';

import {Layout}                 from './layout';
import {Navigation}             from './navigation';
import {ifMobile, mediaQueries} from './responsive';

const Container = styled.div`
  padding: 2em;
  ${ifMobile} {
    padding: 1em;
  }
  ${mediaQueries.minLaptop} {
    display: grid;
    grid-template-columns: auto 300px;
    gap: 0 2vw;
  }
`;

// min-width: 0 otherwise the <pre> blocks break the layout
// https://stackoverflow.com/questions/53599625/css-grid-pre-horizontal-scroll
const ArticleContainer = styled.div`
  min-width: 0;
  max-width: 1200px;
  grid-column: 1;
`;


export const LayoutContentNav = ({items, children}) => {
  return <>

    <Layout>
      <Navigation items={items}>
        <Container>
          <Toc />
          <ArticleContainer>
            {children}
          </ArticleContainer>
        </Container>
      </Navigation>
    </Layout>
  </>;
};
