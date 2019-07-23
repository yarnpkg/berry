import React, {Component}     from 'react';
import qs                     from 'qs';
import {withPrefix}           from 'gatsby';

const updateAfter = 700;
const searchStateToQueryString = searchState => ({
  q: searchState.query,
  p: searchState.page,
  ...(searchState.refinementList && {
    ...(searchState.refinementList['owner.name'] && {
      owner: searchState.refinementList['owner.name'],
    }),
    ...(searchState.refinementList.keywords && {
      keywords: searchState.refinementList.keywords,
    }),
  }),
});

const searchStateToUrl = searchState =>
  searchState
    ? `${withPrefix('/')}?${qs.stringify(
        searchStateToQueryString(searchState)
      )}`
    : '';

const queryStringToSearchState = queryString => {
  const { p, q, owner, keywords } = qs.parse(queryString);
  return {
    query: q,
    page: p || 1,
    refinementList: {
      ...(keywords && { keywords }),
      ...(owner && { 'owner.name': owner }),
    },
  };
};

export default App =>
  class extends Component {
    constructor() {
      super();
      this.state = { searchState: { query: '', page: 1 } };
    }

    componentDidMount() {
      this.originalPathName = window.location.pathname;
      this.originalHref = window.location.href;

      this.setState({ searchState: queryStringToSearchState(window.location.search.slice(1)) });

      window.addEventListener('popstate', ({ state: searchState }) => {
        // check we are on a search result
        if (searchState !== null) {
          this.setState({ searchState });
          return;
        }

        this.setState({ searchState: { query: '', page: 1 } });
      });
    }

    componentWillReceiveProps(nextProps) {
      if (nextProps.location.key !== this.props.location.key) {
        this.originalPathName = window.location.pathname;
        this.originalHref = window.location.href;
        this.setState({ searchState: { query: '', page: 1 } });
      }
    }

    onSearchStateChange = searchState => {
      clearTimeout(this.debouncedSetState);

      if (searchState.query === '') {
        window.history.pushState(
          null,
          'Search packages | Yarn',
          this.originalHref
        );
      } else {
        this.debouncedSetState = setTimeout(() => {
          window.history.pushState(
            searchState,
            'Search packages | Yarn',
            searchStateToUrl(searchState)
          );
        }, updateAfter);
      }

      this.setState({ searchState });
    };

    render() {
      return (
        <App
          {...this.props}
          searchState={this.state.searchState}
          onSearchStateChange={this.onSearchStateChange.bind(this)}
          createURL={searchStateToUrl}
        />
      );
    }
  };
