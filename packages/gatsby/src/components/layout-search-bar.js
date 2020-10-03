import {Only}                                           from 'react-only';
import React                                            from 'react';

import {Header}                                         from './header';
import {Layout}                                         from './layout';
import {ifShortViewport, ifTallViewport, getMediaQuery} from './responsive';
import {SearchBar}                                      from './search/SearchBar';

export const LayoutSearchBar = ({children, searchState, tags, setTags, owners, setOwners}) => {
  const searchBar = <SearchBar
    searchState={searchState}
    tags={tags}
    setTags={setTags}
    owners={owners}
    setOwners={setOwners}
  />;

  return <>
    <Layout header={
      <Header>
        <Only matchMedia={getMediaQuery(ifTallViewport)}>
          {searchBar}
        </Only>
      </Header>
    }>
      <Only matchMedia={getMediaQuery(ifShortViewport)}>{searchBar}</Only>
      {children}
    </Layout>
  </>;
};
