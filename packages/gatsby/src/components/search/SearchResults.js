import styled                             from '@emotion/styled';
import {connectHits, connectStateResults} from 'react-instantsearch-dom';
import {CurrentRefinements, Stats}        from 'react-instantsearch-dom';
import React                              from 'react';

import {Hit}                              from '../hit';
import {isEmpty}                          from '../util';

import {Pagination}                       from './Pagination';

const Hits = connectHits(({hits, onTagClick, onOwnerClick, searchState}) =>
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

const RefinementContainer = styled.div`
  .ais-CurrentRefinements-list {
    list-style-type: none;
    padding: 0;
    margin-top: 0.5em;
    font-size: 0.8125rem;
  }

  .ais-CurrentRefinements-category {
    display: inline-block;
    border: 1px solid #eceeef;
    border-radius: 2px;
    margin-right: 0.5em;
    padding: 0 0.5em;
  }

  .ais-CurrentRefinements-delete {
    background: none;
    border: none;
  }
`;

const ResultsFound = ({pagination, onTagClick, onOwnerClick, searchState}) => (
  <ResultsContainer>
    <StatsText>
      <RefinementContainer>
        <CurrentRefinements />
      </RefinementContainer>
      <Stats
        translations={{
          stats: (num, time) =>
            `found ${num.toLocaleString(`en`)} packages in ${time}ms`,
        }}
      />
    </StatsText>
    <Hits onTagClick={onTagClick} onOwnerClick={onOwnerClick} searchState={searchState} />
    <Pagination pagination={pagination} />
    <SearchFooter>
      Search by Algolia
      {` - `}
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
`;

const RawSearchResults = ({searchState, searchResults, onTagClick, onOwnerClick}) => {
  if (isEmpty(searchState.query)) {
    return null;
  } else if (searchResults && searchResults.nbHits === 0) {
    const docMessage = `Were you looking for something in the {documentation_link}?`.split(/[{}]+/);
    docMessage[docMessage.indexOf(`documentation_link`)] = (
      // I can't think of a better place to link this to
      <a href={`/`}>documentation</a>
    );

    return (
      <NoPackagesFound>
        <p>{`No package ${searchState.query} was found`}</p>
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

export const SearchResults = connectStateResults(RawSearchResults);
