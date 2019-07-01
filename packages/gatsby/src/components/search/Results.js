import React from 'react';
import {
  Pagination,
  CurrentRefinements,
  Stats,
  connectHits,
  createConnector,
} from 'react-instantsearch-dom';

import Hit         from './Hit';
import { isEmpty } from './util';

const body = document.querySelector('body');

const Hits = connectHits(({ hits, onTagClick, onOwnerClick }) =>
  hits.map(hit => (
    <Hit
      onTagClick={onTagClick}
      onOwnerClick={onOwnerClick}
      hit={hit}
      key={hit.objectID}
    />
  ))
);

const ResultsFound = ({ pagination, onTagClick, onOwnerClick }) => (
  <div className="container">
    <div className="mx-3">
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
    </div>
    <Hits onTagClick={onTagClick} onOwnerClick={onOwnerClick} />
    <div className="d-flex">
      {pagination ? (
        <Pagination showFirst={false} showLast={false} scrollTo={true} />
      ) : (
        <div style={{ height: '3rem' }} />
      )}
    </div>
    <div className="search-footer">
      Search by Algolia
      {' - '}
      <a href="https://discourse.algolia.com/t/2016-algolia-community-gift-yarn-package-search/319">
        read how it works
      </a>
      .
    </div>
  </div>
);

const connectResults = createConnector({
  displayName: 'ConnectResults',
  getProvidedProps(props, searchState, searchResults) {
    const pagination = searchResults.results
      ? searchResults.results.nbPages > 1
      : false;
    const noResults = searchResults.results
      ? searchResults.results.nbHits === 0
      : false;
    return { query: searchState.query, noResults, pagination };
  },
});

const Results = connectResults(
  ({ noResults, query, pagination, onTagClick, onOwnerClick }) => {
    if (isEmpty(query)) {
      body.classList.remove('searching');
      return <span />;
    } else if (noResults) {
      body.classList.add('searching');
      const docMessage = 'Were you looking for something in the {documentation_link}?'.split(/[{}]+/);
      docMessage[docMessage.indexOf('documentation_link')] = (
        <a href={`/docs`}>documentation</a>
      );

      return (
        <div className="container text-center mt-5">
          <p>{'No package {name} was found'.replace('{name}', query)}</p>
          <p>
            {docMessage.map((val, index) => <span key={index}>{val}</span>)}
          </p>
        </div>
      );
    } else {
      body.classList.add('searching');
      return (
        <ResultsFound
          pagination={pagination}
          onTagClick={onTagClick}
          onOwnerClick={onOwnerClick}
        />
      );
    }
  }
);

export default Results;
