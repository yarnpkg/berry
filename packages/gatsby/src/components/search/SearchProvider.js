import algoliasearch              from 'algoliasearch/lite';
import {useStaticQuery, graphql}  from 'gatsby';
import {Configure, InstantSearch} from 'react-instantsearch-dom';
import React, {useMemo}           from 'react';

export const SearchProvider = ({
  searchState,
  onSearchStateChange,
  children,
}) => {
  const {
    site: {
      siteMetadata: {
        algolia: {appId, apiKey, indexName},
      },
    },
  } = useStaticQuery(graphql`
    query AlgoliaConfigQuery {
      site {
        siteMetadata {
          algolia {
            appId
            apiKey
            indexName
          }
        }
      }
    }
  `);

  const searchClient = useMemo(() => {
    return algoliasearch(appId, apiKey);
  }, [appId, apiKey]);

  return (
    <InstantSearch
      searchClient={searchClient}
      indexName={indexName}
      searchState={searchState}
      onSearchStateChange={onSearchStateChange}
    >
      <Configure
        hitsPerPage={5}
        // set page parameter by default, since we don't always show pagination
        page={0}
        facets={['keywords']}
        analyticsTags={['yarnpkg.com']}
        attributesToRetrieve={[
          'deprecated',
          'description',
          'downloadsLast30Days',
          'homepage',
          'humanDownloadsLast30Days',
          'keywords',
          'license',
          'modified',
          'name',
          'owner',
          'repository',
          'types',
          'version',
        ]}
        attributesToHighlight={['name', 'description', 'keywords']}
      />
      {children}
    </InstantSearch>
  );
};
