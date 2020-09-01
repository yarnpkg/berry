import React                          from 'react';

import {Header}                       from './header';
import {Layout}                       from './layout';
import {matchesMedia, ifTallViewport} from './responsive';
import {SearchBar}                    from './search/SearchBar';

export const LayoutSearchBar = ({children, searchState, tags, setTags, owners, setOwners}) => {
  const searchBar = <SearchBar
    searchState={searchState}
    tags={tags}
    setTags={setTags}
    owners={owners}
    setOwners={setOwners}
  />;

  return <>
    <Layout header={<Header>{matchesMedia(ifTallViewport) ? searchBar : null}</Header>}>
      {matchesMedia(ifTallViewport) ? null : searchBar}
      {children}
    </Layout>
  </>;
};
