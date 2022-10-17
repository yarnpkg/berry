import Link                                   from '@docusaurus/Link';
import useDocusaurusContext                   from '@docusaurus/useDocusaurusContext';
import {CodeIcon, FileDirectoryIcon}          from '@primer/octicons-react';
import Layout                                 from '@theme/Layout';
import clsx                                   from 'clsx';
import {InstantSearch, useHits, useSearchBox} from 'react-instantsearch-hooks-web';
import React                                  from 'react';

import {searchClient}                         from '../lib/searchClient';

import indexStyles                            from './index.module.css';
import styles                                 from './search.module.css';

type SearchResult = {
  title: string;
  icon: string;
  description: JSX.Element;
};

// eslint-disable-next-line arca/no-default-export
export default function Home(): JSX.Element {
  const {siteConfig} = useDocusaurusContext();

  return (
    <Layout
      // @ts-expect-error
      title={siteConfig.title}
      description={siteConfig.tagline}>
      <InstantSearch indexName={`npm-search`} searchClient={searchClient}>
        <SearchInterface/>
      </InstantSearch>
    </Layout>
  );
}

function SearchInterface() {
  const {hits} = useHits();

  const sortedHits = hits.sort((a, b) => {
    // @ts-expect-error
    return b.downloadsLast30Days - a.downloadsLast30Days;
  });

  return <>
    <div className={styles.searchContainer}>
      <SearchBar/>
    </div>
    <div className={`container`}>
      <div className={`row`}>
        {sortedHits.map(hit => <SearchResult key={hit.rev} hit={hit}/>)}
      </div>
    </div>
  </>;
}

function SearchBar(props: any) {
  const {query, refine} = useSearchBox(props);

  return (
    <input className={clsx(indexStyles.search, styles.search)} autoFocus={true} placeholder={`Search packages (i.e. babel, webpack, react, ...)`} value={query} onChange={e => refine(e.currentTarget.value)}/>
  );
}
function getDownloadBucket(dl: number) {
  if (dl < 1000) {
    return null;
  } else if (dl < 5000) {
    return `hot-t1`;
  } else if (dl < 25000) {
    return `hot-t2`;
  } else if (dl < 1000000) {
    return `hot-t3`;
  } else {
    return `hot-t4`;
  }
}

function SearchResult({hit}: any) {
  const downloadBucket = getDownloadBucket(hit.downloadsLast30Days);

  const dlBadge = downloadBucket !== null && <div className={styles.badge}>
    <img src={`/img/ico-${downloadBucket}.svg`}/>
    <div>{hit.humanDownloadsLast30Days}</div>
  </div>;

  const typeBadge = hit.types.ts === `included`
    ? <div className={styles.badge} style={{background: `#0380d9`, color: `#ffffff`}}>TS</div>
    : hit.types.definitelyTyped
      ? <div className={styles.badge} style={{background: `#03c4d9`, color: `#ffffff`}}>DT</div>
      : <div className={styles.badge} style={{background: `#cccccc`, color: `#ffffff`}}>NT</div>;

  return (
    <div className={clsx(`col col--4`, styles.resultCell)}>
      <div className={styles.result}>
        <div className={styles.resultAside}>
          <div className={styles.resultBadges}>
            {typeBadge}
            {dlBadge}
          </div>

          <div className={styles.resultTools}>
            <Tool icon={FileDirectoryIcon} href={`/listing?name=${encodeURIComponent(hit.name)}&version=${encodeURIComponent(hit.version)}`}/>
            <Tool icon={CodeIcon} href={`https://npm.runkit.com/${hit.name}`}/>
          </div>
        </div>
        <div className={styles.resultMain}>
          <div className={styles.resultTitle}>
            <h3>{hit.name}</h3>
            <div className={styles.resultBy}>
              {` `}by {hit.owner.name}
            </div>
          </div>
          <div className={styles.resultDescription}>
            {hit.description}
          </div>
        </div>
      </div>
    </div>
  );
}

function Tool({icon: Icon, href}: any) {
  return (
    <Link className={styles.tool} href={href} target={`_blank`}>
      <Icon/>
    </Link>
  );
}
