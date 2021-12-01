import {css}                                   from '@emotion/react';
import styled                                  from '@emotion/styled';
import React, {useState}                       from 'react';

import {Header}                                from '../components/header';
import {Layout}                                from '../components/layout';
import {ifDesktop, ifMobile}                   from '../components/responsive';
import {SearchProvider}                        from '../components/search';
import {SearchBar, SearchResults, withUrlSync} from '../components/search';
import {SEO, defaultKeywords}                  from '../components/seo';
import agendaIcon                              from '../images/homeicons/agenda.svg';
import laptopIcon                              from '../images/homeicons/laptop.svg';
import noteIcon                                from '../images/homeicons/note.svg';
import puzzleIcon                              from '../images/homeicons/puzzle.svg';
import rocketIcon                              from '../images/homeicons/rocket.svg';
import worldwideIcon                           from '../images/homeicons/worldwide.svg';

const sectionStyle = css`
  width: 100%;

  padding: 3em 6em;
`;

const Section = styled.div`
  ${sectionStyle}

  ${ifMobile} {
    padding: 0 1em;
  }
`;

const sectionContentStyle = css`
  margin: 0 auto 0 auto;
  width: 1140px;
  max-width: 100%;
`;

const SectionContent = styled.div`
  ${sectionContentStyle}
`;

const Hero = styled.div`
  ${sectionStyle}

  padding-top: 5em;
  padding-bottom: 5em;

  background: #2188b6;

  ${ifMobile} {
    padding: .5em;
  }
`;

const HeroTitle = styled.div`
  font-size: 4em;
  ${ifMobile} {
    font-size: 2.2em;
    text-align: center;
  }

  font-weight: bold;

  color: #ffffff;
  text-shadow: 5px 5px #1476a2
`;

const HeroSubtitle = styled.div`
  max-width: 800px;
  color: #ffffff;
  margin-top: 40px;
  font-size: 1.5em;

  ${ifMobile} {
    margin-top: 20px;
    font-size: 1.2em;
    text-align: center;
    margin-bottom: 10px;
  }
`;

const SellingPoints = styled.div`
  ${ifDesktop} {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
  }
`;

const SellingPointContainer = styled.a`
  display: flex;
  color: #000;

  ${ifDesktop} {
    width: calc(50% - 20px);
  }
  ${ifMobile} {
    align-items: center;
  }

  margin-top: 40px;
  transition: transform .15s ease-in-out;

  &:last-child {
    margin-bottom: 40px;
  }
  &:hover {
    transform: scale(1.05);
  }
`;

const SellingPointIcon = styled.img`
  width: 100px;
  height: 100px;
  ${ifMobile} {
    width: 75px;
    height: 75px;
  }
`;

const SellingPointContent = styled.div`
  margin-left: 20px;

  h3 {
    margin-top: 0;
    ${ifMobile} {
      margin-bottom: .5em;
    }
  }
`;

const Copy = styled.div`
  font-size: 14px;

  ${ifDesktop} {
    display: flex;

    div {
      margin-left: 0;
      margin-right: 0;

      &:last-child {
        margin-left: auto;
      }
    }
  }
`;

const SellingPoint = ({imgUrl, children, href}) => <>
  <SellingPointContainer href={href}>
    <SellingPointIcon src={imgUrl}/>
    <SellingPointContent>
      {children}
    </SellingPointContent>
  </SellingPointContainer>
</>;

const IndexPage = ({data, searchState, onSearchStateChange}) => {
  const [tags, setTags] = useState([]);
  const [owners, setOwners] = useState([]);

  return (<>
    <SearchProvider searchState={searchState} onSearchStateChange={onSearchStateChange}>
      <Layout header=
        {
          <Header>
            <SearchBar
              searchState={searchState}
              tags={tags}
              setTags={setTags}
              owners={owners}
              setOwners={setOwners}
            />
          </Header>
        }
      >
        <SEO title={`Home`} keywords={defaultKeywords} />

        <SearchResults
          onTagClick={tag => setTags([...tags, tag])}
          onOwnerClick={owner => setOwners([...owners, owner])}
        />

        {!searchState.query && <>
          <Hero>
            <SectionContent>
              <HeroTitle>
                Safe, stable, reproducible projects
              </HeroTitle>
              <HeroSubtitle>
                Yarn is a package manager that doubles down as project manager. Whether you work on one-shot projects or large monorepos, as a hobbyist or an enterprise user, we've got you covered.
              </HeroSubtitle>
            </SectionContent>
          </Hero>

          <Section>
            <SectionContent>
              <SellingPoints>
                <SellingPoint imgUrl={agendaIcon} href={`/features/workspaces`}>
                  <h3>Workspaces</h3>
                  Split your project into sub-components kept within a single repository.
                </SellingPoint>
                <SellingPoint imgUrl={laptopIcon} href={`/features/zero-installs#how-does-yarn-impact-a-projects-stability`}>
                  <h3>Stability</h3>
                  Yarn guarantees that an install that works now will continue to work the same way in the future.
                </SellingPoint>
                <SellingPoint imgUrl={noteIcon} href={`/getting-started`}>
                  <h3>Documentation</h3>
                  Special care is put into our documentation, and we keep improving it based on your feedback.
                </SellingPoint>
                <SellingPoint imgUrl={puzzleIcon} href={`/features/plugins`}>
                  <h3>Plugins</h3>
                  Yarn cannot solve all your problems - but it can be the foundation for others to do it.
                </SellingPoint>
                <SellingPoint imgUrl={rocketIcon} href={`/features/pnp`}>
                  <h3>Innovation</h3>
                  We believe in challenging the status quo. What should the ideal developer experience be like?
                </SellingPoint>
                <SellingPoint imgUrl={worldwideIcon} href={`/getting-started/qa#is-yarn-operated-by-facebook`}>
                  <h3>Openness</h3>
                  Yarn is an independent open-source project tied to no company. Your support makes us thrive.
                </SellingPoint>
              </SellingPoints>
            </SectionContent>
          </Section>
        </>}

        <hr/>

        <Section style={{paddingTop: `1em`, paddingBottom: `1em`}}>
          <SectionContent>
            <Copy>
              <div>Yarn · <a href={`https://github.com/yarnpkg/berry/blob/master/LICENSE.md`}>Distributed under BSD License</a> · <a href={`https://github.com/yarnpkg/berry/blob/master/CODE_OF_CONDUCT.md`}>Code of Conduct</a></div>
              <div>Icons by <a href={`https://www.freepik.com`}>Freepik</a> from <a href={`https://www.flaticon.com`}>flaticon.com</a></div>
            </Copy>
          </SectionContent>
        </Section>
      </Layout>
    </SearchProvider>
  </>);
};

// eslint-disable-next-line arca/no-default-export
export default withUrlSync(IndexPage);
