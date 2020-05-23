import styled                                                  from '@emotion/styled';
import React, {useState}                                       from 'react';

import {Details}                                               from '../components/details';
import {Header}                                                from '../components/header';
import {Layout}                                                from '../components/layout';
import {ifMobile}                                              from '../components/responsive';
import {SearchProvider, SearchBar, SearchResults, withUrlSync} from '../components/search';
import {SEO, defaultKeywords}                                  from '../components/seo';

const Hero = styled.div`
  position: relative;
  color: white;
  background-color: #2188b6;
  background-size: 25px auto;
  -webkit-font-smoothing: antialiased;
  overflow: hidden;

  margin-bottom: 3rem;
  padding: 2rem 0;
  ${ifMobile} {
    margin-bottom: 1rem;
    padding: 1rem 0;
  }
`;

const HeroFrame = styled.div`
  padding: 0 15px;
  margin: 0 auto 0 auto;
  width: 1140px;
  max-width: 100%;
`;

const HeroTitle = styled.div`
  font-weight: 400;
  font-size: 3rem;
  ${ifMobile} {
    font-size: 2rem;
  }

  padding: 0 15px;

  color: #ffffff;
  text-shadow: 5px 5px #1476a2
`;

const PackagePage = ({searchState, onSearchStateChange}) => {
  const [tags, setTags] = useState([]);
  const [owners, setOwners] = useState([]);

  let packageName = '';

  if (typeof window !== 'undefined') {
    const [
      /* leading slash */,
      /* package/ */,
      ...parts
    ] = window.location.pathname.split('/');
    packageName = parts.join('/');
  }

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
        <SEO title={packageName} keywords={defaultKeywords} />

        <SearchResults
          onTagClick={tag => setTags([...tags, tag])}
          onOwnerClick={owner => setOwners([...owners, owner])}
        />
        {!searchState.query &&
          <>
            <Hero>
              <HeroFrame>
                <HeroTitle>
                  Package detail
                </HeroTitle>
              </HeroFrame>
            </Hero>
            <Details objectID={packageName} />
          </>
        }
      </Layout>
    </SearchProvider>
  </>);
};

// eslint-disable-next-line arca/no-default-export
export default withUrlSync(PackagePage);
