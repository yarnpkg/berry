import React, {Component}                                 from 'react';
import {Configure, InstantSearch, connectRefinementList}  from 'react-instantsearch-dom';
import {StaticQuery, graphql}                             from 'gatsby';

import SearchBox   from './SearchBox';
import Results     from './Results';
import withUrlSync from './withUrlSync';

const equals = (arr1, arr2) =>
  arr1.length === arr2.length && arr1.reduce((a, b, i) => a && arr2[i], true);

// package overview page
// home page (/:lang/)
const shouldFocus = path =>
  path.includes('/packages') ||
  path.replace(/\/[a-zA-Z-]+\/?/, '').length === 0;

class RefinementList extends Component {
  componentWillReceiveProps(newProps) {
    const { currentRefinement, defaultRefinement, onRefine, refine } = newProps;
    const {
      currentRefinement: oldCurrentRefinement,
      defaultRefinement: oldDefaultRefinement,
    } = this.props;

    if (!equals(currentRefinement, oldCurrentRefinement)) {
      refine(currentRefinement);
      onRefine(currentRefinement);
    }

    if (!equals(defaultRefinement, oldDefaultRefinement)) {
      refine(defaultRefinement);
      onRefine(defaultRefinement);
    }
  }

  render() {
    return null;
  }
}

const VirtualRefinementList = connectRefinementList(RefinementList);

class Search extends Component {
  constructor(props) {
    super(props);
    this.state = { tags: new Set(), owners: new Set() };
  }

  addTag = newTag => this.setState(({ tags }) => ({ tags: tags.add(newTag) }));

  addOwner = newOwner =>
    this.setState(({ owners }) => ({ owners: owners.add(newOwner) }));

  onRefineTag = newTags => this.setState(() => ({ tags: new Set(newTags) }));

  onRefineOwner = newOwners =>
    this.setState(() => ({ owners: new Set(newOwners) }));

  render() {
    const { searchState, onSearchStateChange } = this.props;

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
        render={({ site: { siteMetadata: { algolia }}}) => (
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
          <SearchBox
            autoFocus={shouldFocus(window.location.pathname)}
            translations={{
              placeholder: 'Search packages (i.e. babel, webpack, react…)',
            }}
          />
          <VirtualRefinementList
            attribute="keywords"
            defaultRefinement={[...Array.from(this.state.tags)]}
            onRefine={this.onRefineTag}
          />
          <VirtualRefinementList
            attribute="owner.name"
            defaultRefinement={[...Array.from(this.state.owners)]}
            onRefine={this.onRefineOwner}
          />
          <Results onTagClick={this.addTag} onOwnerClick={this.addOwner} />
        </InstantSearch>
      )} />
    );
  }
}

export default withUrlSync(Search);
