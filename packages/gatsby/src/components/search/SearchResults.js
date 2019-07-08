import React                                   from 'react';
import {CurrentRefinements, Stats}             from 'react-instantsearch-dom';
import {connectHits, connectStateResults}      from 'react-instantsearch-dom';
import styled                                  from '@emotion/styled';

import Pagination from './Pagination';
import Hit        from '../hit';
import {isEmpty}  from '../util';

const Hits = connectHits(({ hits, onTagClick, onOwnerClick, searchState }) =>
  hits.map(hit => (
    <Hit
      onTagClick={onTagClick}
      onOwnerClick={onOwnerClick}
      hit={hit}
      key={hit.objectID}
      searchState={searchState}
    />
  ))
);

const ResultsContainer = styled.div`
  margin: 0 auto 0 auto;
  padding: 0 15px 0 15px;
  width: 1140px;
  max-width: 100%;
`;

const SearchFooter = styled.div`
  text-align: center;
  margin-bottom: 50px;
`;

const StatsText = styled.div`
  padding: 0 16px 0 16px;
`;

const ResultsFound = ({ pagination, onTagClick, onOwnerClick, searchState }) => (
  <ResultsContainer>
    <StatsText>
      <CurrentRefinements />
      <Stats
        translations={{
          stats: (num, time) =>
            'found {number_packages} packages in {time_search}ms'
              .replace(
                '{number_packages}',
                num.toLocaleString('en')
              )
              .replace('{time_search}', time),
        }}
      />
    </StatsText>
    <Hits onTagClick={onTagClick} onOwnerClick={onOwnerClick} searchState={searchState} />
    <Pagination pagination={pagination} />
    <SearchFooter>
      Search by Algolia
      {' - '}
      <a href="https://discourse.algolia.com/t/2016-algolia-community-gift-yarn-package-search/319">
        read how it works
      </a>
      .
    </SearchFooter>
  </ResultsContainer>
);

const NoPackagesFound = styled.div`
  padding: 0 15px;
  margin-top: 3rem;
  text-align: center;
  color: #5a5a5a;
`;

const SearchResults = ({ searchState, searchResults, onTagClick, onOwnerClick }) => {
  if (isEmpty(searchState.query)) {
    return null;
  } else if (searchResults && searchResults.nbHits === 0) {
    const docMessage = 'Were you looking for something in the {documentation_link}?'.split(/[{}]+/);
    docMessage[docMessage.indexOf('documentation_link')] = (
      <a href={`/docs`}>documentation</a>
    );

    return (
      <NoPackagesFound>
        <p>{'No package {name} was found'.replace('{name}', searchState.query)}</p>
        <p>
          {docMessage.map((val, index) => <span key={index}>{val}</span>)}
        </p>
      </NoPackagesFound>
    );
  } else {
    const pagination = searchResults && searchResults.nbPages > 1;
    return (
      <ResultsFound
        pagination={pagination}
        onTagClick={onTagClick}
        onOwnerClick={onOwnerClick}
        searchState={searchState}
      />
    );
  }
};

export default connectStateResults(SearchResults);
