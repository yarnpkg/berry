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

const TocStyle = css`
.toc {
  ${mediaQueries.minLaptop} {
    display: none;
  }
}

@keyframes highlight {
  from {background-color: rgb(255 165 0 / 30%)}
  to {background-color: transparent;}
}

h1, h2, h3, h4 {
  &:target {
    animation-name: highlight;
    animation-duration: 4s;
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
