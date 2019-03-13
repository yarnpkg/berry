import styled from '@emotion/styled';
import React  from 'react';

import Layout from '../components/layout';
import SEO    from '../components/seo';

const SearchContainer = styled.div`
  background: #25799f;

  padding: 1.5em;
`;

const SearchBar = styled.input`
  -webkit-appearance: none;

  width: 100%;

  padding: .5em;

  font-size: inherit;

  border: 0;
  border-radius: 0;
  outline: 0;

  background: #ffffff;
`;

const Hero = styled.div`
  width: 100%;

  padding: 5em 6em;

  background: #2188b6;
`;

const HeroTitle = styled.div`
  font-size: 4em;
  font-weight: bold;

  color: #ffffff;
  text-shadow: 5px 5px #1476a2
`;

const HeroSubtitle = styled.div`
  max-width: 800px;

  margin-top: 40px;

  font-size: 1.5em;
  font-weight: light;

  color: #ffffff;
`;

const IndexPage = () => <>
  <Layout>
    <SEO title="Home" keywords={[`gatsby`, `application`, `react`]} />
    <SearchContainer>
      <SearchBar type={`search`} placeholder={`Search packages (i.e. babel, webpack, react...)`} autoFocus={true} />
    </SearchContainer>
    <Hero>
      <HeroTitle>
        Safe, stable, reproducible projects
      </HeroTitle>
      <HeroSubtitle>
        Yarn is a package manager that doubles down as project manager. Whether you work on one-shot projects or large monorepos, as a hobbyist or an enterprise user, we've got you covered.
      </HeroSubtitle>
    </Hero>
  </Layout>
</>;

export default IndexPage;
