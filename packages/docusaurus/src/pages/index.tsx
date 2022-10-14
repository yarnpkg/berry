import Link                 from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout               from '@theme/Layout';
import HomepageFeatures     from '@yarnpkg/docusaurus/src/components/HomepageFeatures';
import clsx                 from 'clsx';
import React, {useEffect}   from 'react';

import styles               from './index.module.css';

// eslint-disable-next-line arca/no-default-export
export default function Home(): JSX.Element {
  const {siteConfig} = useDocusaurusContext();

  useEffect(() => {
    document.body.classList.add(styles.body);
    return () => {
      document.body.classList.remove(styles.body);
    };
  }, []);

  return (
    <Layout
      // @ts-expect-error
      title={`Hello from ${siteConfig.title}`}
      description={`Description will go into a meta tag in <head />`}>
      <main className={styles.main}>
        <div className={styles.reserve}>
          <div className={styles.hero}>
            <div>
              <h1>Safe, stable,<br />reproducible projects</h1>
              <p>Yarn is a package manager that doubles down as project manager. Whether you work on simple projects or industry monorepos, whether you're an open source developer or an enterprise user, Yarn has your back.</p>
              <div className={styles.search}>
                Search packages (i.e. babel, webpack, react, ...)
              </div>
            </div>
          </div>
        </div>
        <div className={styles.followUp}>
          <HomepageFeatures />
        </div>
      </main>
    </Layout>
  );
}
