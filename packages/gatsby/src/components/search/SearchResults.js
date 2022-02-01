import 'react-responsive-carousel/lib/styles/carousel.min.css';
import styled                             from '@emotion/styled';
import {connectHits, connectStateResults} from 'react-instantsearch-dom';
import {Stats}                            from 'react-instantsearch-dom';
import {Carousel}                         from 'react-responsive-carousel';
import ReactTooltip                       from 'react-tooltip';
import React, {useRef}                    from 'react';

import {Hit}                              from '../hit';
import {isEmpty}                          from '../util';

import {Pagination}                       from './Pagination';

const SPONSORS = [{
  name: `Doppler`,
  description: `Universal Secrets Platform`,
  icon: `https://dashboard.doppler.com/imgs/logo_color.png`,
  url: `https://www.doppler.com/?utm_campaign=github_repo&utm_medium=referral&utm_content=yarn&utm_source=github`,
}, {
  name: `WorkOS`,
  description: `all-in-one solution for enterprise-ready apps`,
  icon: `https://assets-global.website-files.com/5ef26797488fe01cc1b89848/61426734f2f4a013c6f2d774_Favicon%2032x32.png`,
  url: `https://workos.com/?utm_campaign=github_repo&utm_medium=referral&utm_content=berry&utm_source=github`,
}];

const Hits = connectHits(({hits, onTagClick, onOwnerClick, searchState}) =>
  hits.map(hit => (
    <Hit
      onTagClick={onTagClick}
      onOwnerClick={onOwnerClick}
      hit={hit}
      key={hit.objectID}
      searchState={searchState}
    />
  )),
);

const InfoBar = styled.div`
  display: flex;

  background: #2188b6;
  color: rgba(255, 255, 255, 0.8);
`;

const InfoContainer = styled.div`
  display: flex;

  margin: 0 auto 0 auto;
  padding: 0 15px 0 15px;
  width: 1140px;
  max-width: 100%;
`;

const StatsText = styled.div`
  flex: none;
  padding: 0.7rem 0;
  margin-right: 1rem;
`;

const SponsorCarousel = styled(Carousel)`
  margin: auto 0 auto auto;

  .carousel {
    display: flex;
    flex-direction: row-reverse;

    .slide {
      text-align: right;

      img {
        width: 1.2em;
        height: 1.2em;

        vertical-align: middle;
      }
    }
  }

  .control-dots {
    position: relative;

    flex: 1;
    margin: 0;
    line-height: 1em;
  }
`;

const SponsorContainer = styled.a`
  color: inherit;

  span {
    color: #85ecf7;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
`;

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

const Sponsor = ({name, description, icon, url}) => <>
  <SponsorContainer href={url} data-tip={`<a style="font-size: 17px;" href="https://opencollective.com/yarnpkg/contribute/gold-tier-24218">Become a Gold sponsor</a>`}>
    Thanks to <img src={icon} alt={`${name} icon`}/> <span>{name}</span>, the {description}, for sponsoring Yarn!
  </SponsorContainer>
</>;

const ResultsFound = ({pagination, onTagClick, onOwnerClick, searchState}) => {
  // We use a ref to have a new selection on each component creation rather than on each rerender
  const selectedItem = useRef(Math.trunc(Math.random() * SPONSORS.length));

  return <>
    <InfoBar>
      <InfoContainer>
        <StatsText>
          <Stats translations={{stats: (num, time) => `found ${num.toLocaleString(`en`)} packages in ${time}ms`}}/>
        </StatsText>
        <SponsorCarousel
          axis={`vertical`}
          autoPlay={true}
          infiniteLoop={true}
          interval={4000}
          showArrows={false}
          showStatus={false}
          showThumbs={false}
          selectedItem={selectedItem.current}
        >
          {SPONSORS.map(sponsor => <Sponsor key={sponsor.name} {...sponsor} />)}
        </SponsorCarousel>
        <ReactTooltip
          place={`right`}
          offset={{right: 20}}
          effect={`solid`}
          backgroundColor={`#ffac33`}
          delayHide={4000}
          html={true}
          clickable={true}
        />
      </InfoContainer>
    </InfoBar>
    <ResultsContainer>
      <Hits onTagClick={onTagClick} onOwnerClick={onOwnerClick} searchState={searchState} />
      <Pagination pagination={pagination} />
      <SearchFooter>
      Search by Algolia
        {` - `}
        <a href={`https://discourse.algolia.com/t/2016-algolia-community-gift-yarn-package-search/319`}>
        read how it works
        </a>
      .
      </SearchFooter>
    </ResultsContainer>
  </>;
};

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
