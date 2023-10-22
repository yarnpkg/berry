import clsx   from 'clsx';
import React  from 'react';

import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  icon: string;
  description: JSX.Element;
};

const FeatureList: Array<FeatureItem> = [
  {
    title: `Workspaces`,
    icon: `icon-workspaces`,
    description: (
      <>
        First package manager built specifically around workspaces, Yarn lets
        you split your project into sub-components.
      </>
    ),
  },
  {
    title: `Stability`,
    icon: `icon-stability`,
    description: (
      <>
        Yarn guarantees that installs that work today will keep working the
        same way in the future.
      </>
    ),
  },
  {
    title: `Documentation`,
    icon: `icon-documentation`,
    description: (
      <>
        Special care is put into our documentation, which we keep improving at
        every new version.
      </>
    ),
  },
  {
    title: `Plugins`,
    icon: `icon-plugins`,
    description: (
      <>
        Yarn may not solve all your problems - but it'll give you the tools to
        solve the ones you find on your way.
      </>
    ),
  },
  {
    title: `Innovation`,
    icon: `icon-innovation`,
    description: (
      <>
        We believe in challenging the status quo. Yarn will always be at the
        frontline, brewing new workflows and improving old ones.
      </>
    ),
  },
  {
    title: `Openness`,
    icon: `icon-openness`,
    description: (
      <>
        Yarn is a fully independent open-source project tied to no company. Our
        contributor community defines the roadmap.
      </>
    ),
  },
];

function Feature({icon, title, description}: FeatureItem) {
  return (
    <div className={clsx(`col col--4`, styles.feature)}>
      <div className={`text--center`}>
        <img className={styles.icon} width={200} height={180} src={`/img/${icon}.png`} />
      </div>
      <div className={`text--center padding-horiz--md`}>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

// eslint-disable-next-line arca/no-default-export
export default function HomepageFeatures(): JSX.Element {
  return (
    <section className={styles.features}>
      <div className={`container`}>
        <div className={`row`}>
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
