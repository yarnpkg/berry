import styled                                                  from '@emotion/styled';
import React, {useState}                                       from 'react';

import {Details}                                               from '../components/details';
import {Header}                                                from '../components/header';
import {Layout}                                                from '../components/layout';
import {ifMobile}                                              from '../components/responsive';
import {SearchProvider, SearchBar, SearchResults, withUrlSync} from '../components/search';
import {SEO, defaultKeywords}                                  from '../components/seo';

const DetailsContainer = styled.div`
  margin-top: 3rem;

  ${ifMobile} {
    margin-top: 1rem;
  }
`;

const PackagePage = ({searchState, onSearchStateChange}) => {
  const [tags, setTags] = useState([]);
  const [owners, setOwners] = useState([]);

  let packageName = ``;

  if (typeof window !== `undefined`) {
    const [
      /* leading slash */,
      /* package/ */,
      ...parts
    ] = window.location.pathname.split(`/`);
    packageName = parts.join(`/`);
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
          <DetailsContainer>
            <Details objectID={packageName} />
          </DetailsContainer>
        }
      </Layout>
    </SearchProvider>
  </>);
};

// eslint-disable-next-line arca/no-default-export
export default withUrlSync(PackagePage);
