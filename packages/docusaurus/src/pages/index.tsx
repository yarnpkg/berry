import {useHistory}                 from '@docusaurus/router';
import {HtmlClassNameProvider}      from '@docusaurus/theme-common';
import useDocusaurusContext         from '@docusaurus/useDocusaurusContext';
import Layout                       from '@theme/Layout';
import HomepageFeatures             from '@yarnpkg/docusaurus/src/components/HomepageFeatures';
import React, {useEffect, useState} from 'react';

import {StarrySky}                  from '../components/StarrySky';

import styles                       from './index.module.css';

// eslint-disable-next-line arca/no-default-export
export default function Home(): JSX.Element {
  const {siteConfig} = useDocusaurusContext();
  const history = useHistory();

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    history.push(`/search?q=${encodeURIComponent(event.target.value)}`);
  };

  const [versions, setVersions] = useState<{
    stable: string;
    canary: string;
  } | null>(null);

  useEffect(() => {
    Promise.resolve().then(async () => {
      // eslint-disable-next-line no-restricted-globals
      const res = await fetch(`https://repo.yarnpkg.com/tags`);
      if (!res.ok)
        return;

      const data = await res.json();
      setVersions(data.latest);
    });
  }, []);

  return (
    <Layout
      title={`Home page`}
      description={siteConfig.tagline}>
      <HtmlClassNameProvider className={styles.html}>
        <main className={styles.main}>
          <div className={styles.reserve}>
            <div className={styles.art}>
              <StarrySky/>
            </div>
            <div className={styles.hero}>
              <h1>
                Safe, stable,<br />
                reproducible projects
                <div className={styles.versions}>
                  <div className={styles.versionLine}>
                    <div className={styles.channel}>
                      stable
                    </div>
                    <div className={styles.version}>
                      {versions?.stable ?? `...`}
                    </div>
                  </div>
                  <div className={styles.versionLine}>
                    <div className={styles.channel}>
                      canary
                    </div>
                    <div className={styles.version}>
                      {versions?.canary ?? `...`}
                    </div>
                  </div>
                </div>
              </h1>
              <p>Yarn is a package manager that doubles down as project manager. Whether you work on simple projects or industry monorepos, whether you're an open source developer or an enterprise user, Yarn has your back.</p>
              <input className={styles.search} placeholder={`Search packages (i.e. babel, webpack, react, ...)`} autoFocus={true} onChange={handleChange}/>
              <div className={styles.info}>
                This documentation covers Yarn 4, currently available as a Release Candidate. For the previous documentation, please refer to <a href={`https://v3.yarnpkg.com/`}>v3.yarnpkg.com</a>.
              </div>
            </div>
          </div>
          <div className={styles.followUp}>
            <HomepageFeatures />
          </div>
        </main>
      </HtmlClassNameProvider>
    </Layout>
  );
}
