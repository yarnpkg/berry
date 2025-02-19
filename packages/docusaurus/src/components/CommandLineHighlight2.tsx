import Link                                      from '@docusaurus/Link';
import React, {Children, type PropsWithChildren} from 'react';

import styles                                    from './CommandLineHighlight.module.css';

export function Block({children}: PropsWithChildren) {
  return (
    <pre className={styles.block}>
      <code>
        {children}
      </code>
    </pre>
  );
}
export function Inline({children}: PropsWithChildren) {
  return (
    <span className={styles.inline}>
      <code>
        {children}
      </code>
    </span>
  );
}

export function BlockLine({children}: PropsWithChildren) {
  return <div>
    <Prompt />
    {children}
  </div>;
}
export function Command({children}: PropsWithChildren) {
  return Children.map(children, (child, i) => <>
    {i !== 0 && <span>&nbsp;</span>}
    {child}
  </>);
}

export function Prompt() {
  return <span className={styles.prompt}>$&nbsp;</span>;
}

function Token({children, type, tooltip}: {children: string, type: string, tooltip?: string}) {
  return (
    <span
      className={styles.token}
      data-type={type}
      data-tooltip-id={tooltip ? `tooltip` : undefined}
      data-tooltip-content={tooltip}
    >{children}</span>
  );
}

export function Binary({children}: {children: string}) {
  return <Token type={`binary`}>{children}</Token>;
}

export function Path({children, href, tooltip}: {children: string, href?: string, tooltip?: string }) {
  return href
    ? <Link href={href} className={styles.path}><Token type={`path`} tooltip={tooltip}>{children}</Token></Link>
    : <span className={styles.path}><Token type={`path`} tooltip={tooltip}>{children}</Token></span>;
}

export function Positional({children}: {children: string}) {
  return <Token type={`positional`}>{children}</Token>;
}

export function Option({children, tooltip}: {children: string, tooltip?: string}) {
  const [,dashes, option] = children.match(/^(--(?:no-)?|-?)(.+)$/s)!;
  return <>
    <span className={styles.token} data-type={`dash`}>{dashes}</span>
    {dashes === `-`
      ? Array.from(option, (name, i) => (<Token key={i} type={`option`} tooltip={tooltip}>{name}</Token>))
      : <Token type={`option`} tooltip={tooltip}>{option}</Token>
    }
  </>;
}

export function Value({children}: {children: string}) {
  return <Token type={`value`}>{children}</Token>;
}

export function Assign({children}: {children: string}) {
  return <Token type={`assign`}>{children}</Token>;
}

export function Unknown({children}: {children: string}) {
  return <Token type={`unknown`}>{children}</Token>;
}

export function Comment({children}: {children: string}) {
  return <span className={styles.comment}>{children}</span>;
}
