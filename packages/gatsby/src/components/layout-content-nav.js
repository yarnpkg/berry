import styled                   from '@emotion/styled';
import { Global, css }          from '@emotion/core';
import React                    from 'react';

import {Layout}                 from './layout';
import {Navigation}             from './navigation';
import {ifMobile, mediaQueries} from './responsive';
import {Toc} from '../components/toc';

const Container = styled.div`
  padding: 2em;
  ${ifMobile} {
    padding: 1em;
  }
  ${mediaQueries.minLaptop} {
    border-top: 1px solid #cfdee9;
    display: grid;
    grid-template-columns: auto 300px;
    gap: 0 2vw;
  }
`;

const ArticleContainer = styled.div`
  max-width: 1200px;
  grid-column: 1;
`;

const TocStyle = css`
.toc {
  ${mediaQueries.minLaptop} {
    display: none;
  }
}
`;

export const LayoutContentNav = ({items, children}) => {
  return <>
    <Global styles={TocStyle} />
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
