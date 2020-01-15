import React, {useState}                       from 'react';
import styled                                  from '@emotion/styled';

import Header                                  from '../components/header';
import {SearchBar, SearchResults, withUrlSync} from '../components/search';
import {SearchProvider}                        from '../components/search';
import Layout                                  from '../components/layout';
import SEO                                     from '../components/seo';
import Details                                 from '../components/details';

const Hero = styled.div`
  position: relative;
  margin: 0;
  padding: 2rem 0;
  color: white;
  background-color: #2188b6;
  background-size: 25px auto;
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
  margin: 0 0 3rem 0;
`;

const HeroFrame = styled.div`
  padding: 0 15px;
  margin: 0 auto 0 auto;
  width: 1140px;
  max-width: 100%;
`;

const HeroTitle = styled.div`
  font-size: 3rem;
  font-weight: 400;

  padding: 0 15px;

  color: #ffffff;
  text-shadow: 5px 5px #1476a2
`;

const PackagePage = ({ searchState, onSearchStateChange }) => {
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
        <SEO title="Home" keywords={[`gatsby`, `application`, `react`]} />

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

export default withUrlSync(PackagePage);
