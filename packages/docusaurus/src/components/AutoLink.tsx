import Link   from '@docusaurus/Link';
import React  from 'react';

import styles from './AutoLink.module.css';

export type AutoLinkProps = {
  title: string;
  url: string | null;
  name: string;
  value?: string;
};

export function AutoLink({title, url, name, value}: AutoLinkProps) {
  const keyElement = url !== null
    ? <Link className={styles.key} children={name} href={url}/>
    : <span className={styles.key} children={name}/>;

  return (
    <code data-tooltip-id={`tooltip`} data-tooltip-content={title}>
      {keyElement}
      {value && <>
        <span className={styles.assign}>
          :
        </span>
        {` `}
        <span className={styles.value}>
          {value}
        </span>
      </>}
    </code>
  );
}
