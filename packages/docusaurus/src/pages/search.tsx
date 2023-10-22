import Link                                                       from '@docusaurus/Link';
import {useHistory, useLocation}                                  from '@docusaurus/router';
import useDocusaurusContext                                       from '@docusaurus/useDocusaurusContext';
import {CodeIcon, FileDirectoryIcon}                              from '@primer/octicons-react';
import Layout                                                     from '@theme/Layout';
import clsx                                                       from 'clsx';
import {InstantSearch, useHits, useSearchBox}                     from 'react-instantsearch-hooks-web';
import Skeleton                                                   from 'react-loading-skeleton';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {searchClient}                                             from '../lib/searchClient';

import indexStyles                                                from './index.module.css';
import styles                                                     from './search.module.css';

type SearchResult = {
  title: string;
  icon: string;
  description: JSX.Element;
};

const SPONSORS = [{
  name: `WorkOS`,
  image: `https://assets-global.website-files.com/621f54116cab10f6e9215d8b/621f548d3bca3b62c4bfe1c2_Favicon%2032x32.png`,
  link: `https://workos.com/?utm_campaign=github_repo&utm_medium=referral&utm_content=berry&utm_source=github`,
  extra: `, the all-in-one solution for enterprise-ready apps`,
}];

// eslint-disable-next-line arca/no-default-export
export default function Packages(): JSX.Element {
  const {siteConfig} = useDocusaurusContext();

  return (
    <Layout
      title={`Package search`}
      description={siteConfig.tagline}>
      <InstantSearch indexName={`npm-search`} searchClient={searchClient}>
        <SearchInterface/>
      </InstantSearch>
    </Layout>
  );
}

const defaultRequests = [
  `clipanion`,
  `typescript`,
  `next`,
  `jest`,
  `eslint`,
  `esbuild`,
  `webpack`,
  `ts-node`,
  `typanion`,
].map(objectId => ({
  indexName: `npm-search`,
  objectID: objectId,
}));

function useHitsWithDefaults(query: string): Array<any> {
  const {hits} = useHits({escapeHTML: false});
  const [defaults, setDefaults] = useState<Array<any> | null>(null);

  useEffect(() => {
    searchClient.customRequest({method: `POST`, path: `/1/indexes/*/objects`}, {
      data: {requests: defaultRequests},
    }).then(({results}: any) => {
      setDefaults(results);
    });
  }, []);

  if (query)
    return hits;

  if (!defaults)
    return defaultRequests.map((_, index) => ({rev: `!${index}`}));

  return defaults;
}

function SearchInterface() {
  const history = useHistory();
  const location = useLocation();

  const refreshRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  const queryHook = useCallback((query: string, hook: (value: string) => void) => {
    if (refreshRef.current !== null)
      cancelAnimationFrame(refreshRef.current);

    refreshRef.current = requestAnimationFrame(() => hook(query));
  }, []);

  const {query, refine} = useSearchBox({queryHook});
  const hits = useHitsWithDefaults(query);

  useEffect(() => {
    const keyDownHandler = (event: KeyboardEvent) => {
      if (event.key === `Escape`) {
        history.goBack();
      }
    };

    document.addEventListener(`keydown`, keyDownHandler);
    return () => {
      document.removeEventListener(`keydown`, keyDownHandler);
    };
  }, []);

  useEffect(() => {
    const parsedSearch = new URLSearchParams(location.search);
    refine(parsedSearch.get(`q`) ?? ``);
  }, [location.search]);

  const sponsor = useMemo(() => {
    return SPONSORS[Math.floor(Math.random() * SPONSORS.length)];
  }, []);

  return <>
    <div className={styles.searchContainer}>
      <SearchBar/>
    </div>
    <div className={clsx(styles.searchContainer, styles.sponsors)}>
      The Yarn project is sponsored on <a href={`https://opencollective.com/yarnpkg`}>OpenCollective</a> by <a className={styles.sponsor} href={sponsor.link}><img src={sponsor.image} style={{height: `1.2rem`}}/><span>{sponsor.name}</span></a>{sponsor.extra}. Thanks to them!
    </div>
    <div className={clsx(styles.searchContainer, styles.searchResults)}>
      <div className={`row`}>
        {hits.map(hit => <SearchResult key={hit.rev} query={query} hit={hit}/>)}
      </div>
    </div>
    <div/>
  </>;
}

function SearchBar() {
  const history = useHistory();

  const location = useLocation();
  const search = new URLSearchParams(location.search);
  const query = search.get(`q`) ?? ``;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set(`q`, e.currentTarget.value);
    history.replace(`?${searchParams.toString()}`);
  };

  return (
    <input className={clsx(indexStyles.search, styles.search)} autoFocus={true} placeholder={`Search packages (i.e. babel, webpack, react, ...)`} value={query} onChange={handleChange}/>
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
  const downloadBucket = hit.downloadsLast30Days
    ? getDownloadBucket(hit.downloadsLast30Days)
    : null;

  const dlBadge = downloadBucket !== null && <div className={styles.badge}>
    <img src={`/img/ico-${downloadBucket}.svg`}/>
    <div>{hit.humanDownloadsLast30Days}</div>
  </div>;

  const versionBadge = hit.version && <div className={styles.badge} style={{marginLeft: `auto`, marginRight: 0}}>
    {hit.version}
  </div>;

  const typeBadge = hit.types
    ? hit.types.ts === `included`
      ? <div className={styles.badge} style={{background: `#0380d9`, color: `#ffffff`}}>TS</div>
      : hit.types.definitelyTyped
        ? <div className={styles.badge} style={{background: `#03c4d9`, color: `#ffffff`}}>DT</div>
        : <div className={styles.badge} style={{background: `#cccccc`, color: `#ffffff`}}>NT</div>
    : null;

  const listing = hit.name
    ? `/package?q=${encodeURIComponent(query)}&name=${encodeURIComponent(hit.name)}`
    : null;

  const title = hit.name && hit.owner?.name && (
    <div className={styles.resultTitle}>
      <h3 className={`text--truncate`}>
        {hit.name}
      </h3>
      <div className={styles.resultBy}>
        {` `}by {hit.owner?.name}
      </div>
    </div>
  );

  return (
    <div className={clsx(`col col--4`, styles.resultCell)}>
      <div className={styles.result}>
        {listing && <Link className={styles.resultLink} href={listing}/>}
        <div className={styles.resultAside}>
          <div className={styles.resultBadges}>
            {typeBadge}
            {dlBadge}
            {versionBadge}
          </div>
          <div className={styles.resultTools}>
            <Tool icon={FileDirectoryIcon} href={listing}/>
            <Tool icon={CodeIcon} href={hit.name && `https://npm.runkit.com/${hit.name}`}/>
          </div>
        </div>
        <div className={styles.resultMain}>
          {title ?? <Skeleton/>}
          <div className={styles.resultDescription}>
            {title ? hit.description : <Skeleton count={2}/>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Tool({icon: Icon, href}: any) {
  const Component = href ? `a` : `div`;

  return (
    <Component className={styles.tool} href={href} target={href?.startsWith(`https:`) ? `_blank` : undefined}>
      <Icon/>
    </Component>
  );
}
