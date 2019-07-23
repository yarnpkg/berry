import styled            from '@emotion/styled';
import React, {useState} from 'react';

import Header                                  from '../components/header';
import {SearchBar, SearchResults, withUrlSync} from '../components/search';
import {SearchProvider}                        from '../components/search';
import Layout                                  from '../components/layout';
import {ifMobile}                              from '../components/responsive';
import SEO                                     from '../components/seo';

const Hero = styled.div`
  width: 100%;

  padding: 5em 6em;

  background: #2188b6;

  ${ifMobile} {
    padding: .5em;
  }
`;

const HeroFrame = styled.div`
  margin: 0 auto 0 auto;
  width: 1140px;
  max-width: 100%;
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

const IndexPage = ({ searchState, onSearchStateChange }) => {
  const [tags, setTags] = useState([]);
  const [owners, setOwners] = useState([]);

  return (<>
    <SearchProvider searchState={searchState} onSearchStateChange={onSearchStateChange}>
      <Layout header=
        {
          <Header>
            <SearchBar
              searchState={searchState}
              tags={tags}
              setTags={setTags}
              owners={owners}
              setOwners={setOwners}
            />
          </Header>
        }
      >
        <SEO title="Home" keywords={[`gatsby`, `application`, `react`]} />

        <SearchResults
          onTagClick={tag => setTags([...tags, tag])}
          onOwnerClick={owner => setOwners([...owners, owner])}
        />
        {!searchState.query &&
          <Hero>
            <HeroFrame>
              <HeroTitle>
                Safe, stable, reproducible projects
              </HeroTitle>
              <HeroSubtitle>
                Yarn is a package manager that doubles down as project manager. Whether you work on one-shot projects or large monorepos, as a hobbyist or an enterprise user, we've got you covered.
              </HeroSubtitle>
            </HeroFrame>
          </Hero>
        }
      </Layout>
    </SearchProvider>
  </>);
};

export default withUrlSync(IndexPage);
