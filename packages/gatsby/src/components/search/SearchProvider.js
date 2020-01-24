import {StaticQuery, graphql}     from 'gatsby';
import {Configure, InstantSearch} from 'react-instantsearch-dom';
import React                      from 'react';

export const SearchProvider = ({searchState, onSearchStateChange, children}) => {
  return (
    <StaticQuery query={
      graphql`query AlgoliaConfigQuery {
        site {
          siteMetadata {
            algolia {
              appId
              apiKey
              indexName
            }
          }
        }
      }`}
    render={({site: {siteMetadata: {algolia}}}) => (
      <InstantSearch
        appId={algolia.appId}
        apiKey={algolia.apiKey}
        indexName={algolia.indexName}
        searchState={searchState}
        onSearchStateChange={onSearchStateChange}
      >
        <Configure
          hitsPerPage={5}
          facets={['keywords']}
          analyticsTags={['yarnpkg.com']}
          attributesToRetrieve={[
            'deprecated',
            'description',
            'downloadsLast30Days',
            'repository',
            'homepage',
            'humanDownloadsLast30Days',
            'keywords',
            'license',
            'modified',
            'name',
            'owner',
            'version',
          ]}
          attributesToHighlight={['name', 'description', 'keywords']}
        />
        {children}
      </InstantSearch>
    )}
    />
  );
};
