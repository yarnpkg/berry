import Link                                              from '@docusaurus/Link';
import {useHistory}                                      from '@docusaurus/router';
import useDocusaurusContext                              from '@docusaurus/useDocusaurusContext';
import {CodeIcon, FileDirectoryIcon}                     from '@primer/octicons-react';
import Layout                                            from '@theme/Layout';
import clsx                                              from 'clsx';
import {InstantSearch, useHits, useSearchBox}            from 'react-instantsearch-hooks-web';
import React, {useCallback, useEffect, useRef, useState} from 'react';

import {searchClient}                                    from '../lib/searchClient';

import indexStyles                                       from './index.module.css';
import styles                                            from './packages.module.css';

type SearchResult = {
  title: string;
  icon: string;
  description: JSX.Element;
};

// eslint-disable-next-line arca/no-default-export
export default function Packages(): JSX.Element {
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

const defaultRequests = [
  `typanion`,
  `clipanion`,
  `typescript`,
  `ts-node`,
  `jest`,
  `esbuild`,
  `webpack`,
  `next`,
  `eslint`,
].map(objectId => ({
  indexName: `npm-search`,
  objectID: objectId,
}));

function useHitsWithDefaults(query: string) {
  const {hits} = useHits();
  const [defaults, setDefaults] = useState<Array<any>>([]);

  useEffect(() => {
    if (query !== ``)
      return;

    setDefaults([]);
    searchClient.customRequest({method: `POST`, path: `/1/indexes/*/objects`}, {
      data: {requests: defaultRequests},
    }).then(({results}: any) => {
      setDefaults(results);
    });
  }, [query]);

  return query ? hits : defaults;
}

function SearchInterface() {
  const refreshRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  const queryHook = useCallback((query: string, hook: (value: string) => void) => {
    if (refreshRef.current !== null)
      cancelAnimationFrame(refreshRef.current);

    refreshRef.current = requestAnimationFrame(() => hook(query));
  }, []);

  const {query, refine} = useSearchBox({queryHook});
  const hits = useHitsWithDefaults(query);

  const sortedHits = hits.sort((a, b) => {
    return b.downloadsLast30Days - a.downloadsLast30Days;
  });

  return <>
    <div className={styles.searchContainer}>
      <SearchBar query={query} refine={refine}/>
    </div>
    <div className={`container`}>
      <div className={`row`}>
        {sortedHits.map(hit => <SearchResult key={hit.rev} query={query} hit={hit}/>)}
      </div>
    </div>
  </>;
}

function SearchBar({refine}: any) {
  const [value, setValue] = useState<string>(``);
  const history = useHistory();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.currentTarget.value;

    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set(`q`, query);
    history.replace(`?${searchParams.toString()}`);

    setValue(query);
    refine(query);
  };

  return (
    <input className={clsx(indexStyles.search, styles.search)} autoFocus={true} placeholder={`Search packages (i.e. babel, webpack, react, ...)`} value={value} onChange={handleChange}/>
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

function SearchResult({query, hit}: any) {
  const downloadBucket = getDownloadBucket(hit.downloadsLast30Days);

  const dlBadge = downloadBucket !== null && <div className={styles.badge}>
    <img src={`/img/ico-${downloadBucket}.svg`}/>
    <div>{hit.humanDownloadsLast30Days}</div>
  </div>;

  const versionBadge = <div className={styles.badge} style={{marginLeft: `auto`, marginRight: 0}}>
    {hit.version}
  </div>;

  const typeBadge = hit.types.ts === `included`
    ? <div className={styles.badge} style={{background: `#0380d9`, color: `#ffffff`}}>TS</div>
    : hit.types.definitelyTyped
      ? <div className={styles.badge} style={{background: `#03c4d9`, color: `#ffffff`}}>DT</div>
      : <div className={styles.badge} style={{background: `#cccccc`, color: `#ffffff`}}>NT</div>;

  const listing = `/listing?q=${encodeURIComponent(query)}&name=${encodeURIComponent(hit.name)}&version=${encodeURIComponent(hit.version)}`;

  return (
    <div className={clsx(`col col--4`, styles.resultCell)}>
      <div className={styles.result}>
        <Link className={styles.resultLink} href={listing}/>
        <div className={styles.resultAside}>
          <div className={styles.resultBadges}>
            {typeBadge}
            {dlBadge}
            {versionBadge}
          </div>
          <div className={styles.resultTools}>
            <Tool icon={FileDirectoryIcon} href={listing}/>
            <Tool icon={CodeIcon} href={`https://npm.runkit.com/${hit.name}`}/>
          </div>
        </div>
        <div className={styles.resultMain}>
          <div className={styles.resultTitle}>
            <h3 className={`text--truncate`}>
              {hit.name}
            </h3>
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
    <Link className={styles.tool} href={href} target={href.startsWith(`https:`) ? `_blank` : undefined}>
      <Icon/>
    </Link>
  );
}
