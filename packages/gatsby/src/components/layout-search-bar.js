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

  const isTallViewport = matchesMedia(ifTallViewport);

  return <>
    <Layout header={<Header>{isTallViewport ? searchBar : null}</Header>}>
      {isTallViewport ? null : searchBar}
      {children}
    </Layout>
  </>;
};
