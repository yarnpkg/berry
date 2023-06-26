import styled                  from '@emotion/styled';
import {connectRefinementList} from 'react-instantsearch-dom';
import React, {Component}      from 'react';

import {SearchBox}             from './SearchBox';

const equals = (arr1, arr2) =>
  arr1.length === arr2.length && arr1.reduce((a, b, i) => a && arr2[i], true);

const SearchContainer = styled.div`
  background-color: #25799f;
  transition: background-color 0.1s ease;
  padding: 1.4em 0.3em;
  box-sizing: border-box;
  position: relative;
`;

const WarnBox = styled.a`
  display: block;
  text-decoration: none;
  color: black;
  background: #ffefd1;
  padding: 0.4em 0.8em;
  font-size: .8em;
  border-radius: 0.2em;
  max-width: 1140px;
  margin: auto;
  margin-top: 1.4em;
`;

// home page (/:lang/)
const shouldFocus = path =>
  path.endsWith(`/`) ||
  path.replace(/\/[a-zA-Z-]+\/?/, ``).length === 0;

class RefinementList extends Component {
  componentWillReceiveProps(newProps) {
    const {currentRefinement, defaultRefinement, onRefine, refine} = newProps;
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

export const SearchBar = ({searchState, onSearchStateChange, tags, setTags, owners, setOwners}) => (
  <SearchContainer className={searchState.query ? `searching` : ``}>
    <SearchBox
      autoFocus={shouldFocus(typeof window !== `undefined` ? window.location.pathname : ``)}
      translations={{
        placeholder: `Search packages (i.e. babel, webpack, react…)`,
      }}
    />
    <WarnBox href={`https://github.com/npm/feedback/discussions/937`} target={`_blank`}>
      New packages and versions may not show up in this interface due to an <span style={{color: `#26799f`, textDecoration: `underline`}}>ongoing npm incident</span>. Only search is affected, installs work as usual.
    </WarnBox>
    <VirtualRefinementList
      attribute={`keywords`}
      defaultRefinement={tags}
      onRefine={tags => setTags(tags)}
    />
    <VirtualRefinementList
      attribute={`owner.name`}
      defaultRefinement={owners}
      onRefine={owners => setOwners(owners)}
    />
  </SearchContainer>
);
