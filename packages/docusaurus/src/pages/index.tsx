import Link                 from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout               from '@theme/Layout';
import HomepageFeatures     from '@yarnpkg/docusaurus/src/components/HomepageFeatures';
import clsx                 from 'clsx';
import React                from 'react';

import styles               from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx(`hero hero--primary`, styles.heroBanner)}>
      <div className={`container`}>
        <h1 className={`hero__title`}>{siteConfig.title}</h1>
        <p className={`hero__subtitle`}>{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className={`button button--secondary button--lg`}
            to={`/docs/intro`}>
            Docusaurus Tutorial - 5min ⏱️
          </Link>
        </div>
      </div>
    </header>
  );
}

// eslint-disable-next-line arca/no-default-export
export default function Home(): JSX.Element {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      // @ts-expect-error
      title={`Hello from ${siteConfig.title}`}
      description={`Description will go into a meta tag in <head />`}>
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
