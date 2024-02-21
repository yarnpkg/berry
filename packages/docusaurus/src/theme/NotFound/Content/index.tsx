import Content      from '@theme-original/NotFound/Content';
import type {Props} from '@theme/NotFound/Content';
import clsx         from 'clsx';
import React        from 'react';

import styles       from './styles.module.css';

// eslint-disable-next-line arca/no-default-export
export default function ContentWrapper(props: Props): JSX.Element {
  return <Content {...props} className={clsx(props.className, styles.notFoundContent)}/>;
}
