import Link                                    from '@docusaurus/Link';
import {stringifyArgument}                     from '@yarnpkg/parsers';
import React                                   from 'react';

import type {CommandLine, RawLine, ScriptLine} from '../remark/commandLineHighlight';

import styles                                  from './CommandLineHighlight.module.css';

const getTooltip = ({tooltip}: {tooltip: string | null}) => tooltip ? {
  [`data-tooltip-id`]: `tooltip`,
  [`data-tooltip-content`]: tooltip,
} as const : null;

function RawLine({line}: {line: RawLine}) {
  return (
    <div className={styles.comment}>
      {line.value}
    </div>
  );
}

function CommandLine({line}: {line: CommandLine}) {
  let firstPathToken = line.tokens.findIndex(token => token.type === `path`);
  if (firstPathToken === -1)
    firstPathToken = line.tokens.length;

  let firstNonPathToken = line.tokens.findIndex((token, i) => i >= firstPathToken && token.type !== `path`);
  if (firstNonPathToken === -1)
    firstNonPathToken = line.tokens.length;

  const renderTokens = (start: number, end: number) => {
    return line.tokens.slice(start, end).map((token, index) => <React.Fragment key={index}>
      {start + index > 0 && token.segmentIndex !== line.tokens[start + index - 1].segmentIndex && (token.type !== `path` || index > 0) ? ` ` : null}
      <span className={styles.token} data-type={token.type} {...getTooltip(token)}>
        {stringifyArgument({type: `argument`, segments: [{type: `text`, text: token.text}]})}
      </span>
    </React.Fragment>);
  };

  const wrapPath: (children: React.ReactNode) => React.ReactNode = line.tooltip
    ? children => <Link className={styles.path} href={`/cli/${line.command.path.join(`/`)}`} {...getTooltip(line)} children={children}/>
    : children => <span className={styles.path} children={children}/>;

  return <>
    {!line.split && <>
      <span className={styles.token} data-type={`binary`}>
        {line.command.name}
      </span>
      {line.tokens.length > 0 ? ` ` : null}
    </>}
    {firstPathToken > 0 && renderTokens(0, firstPathToken)}
    {firstPathToken > 0 && firstPathToken < line.tokens.length ? ` ` : null}
    {firstNonPathToken > 0 && wrapPath(renderTokens(firstPathToken, firstNonPathToken))}
    {renderTokens(firstNonPathToken, line.tokens.length)}
  </>;
}

const LineComponents: {
  [T in ScriptLine[`type`]]: React.ComponentType<{line: Extract<ScriptLine, {type: T}>}>;
} = {
  raw: RawLine,
  command: CommandLine,
};

const LineComponent = ({line}: {line: CommandLine}) => {
  const Component = LineComponents[line.type];
  return <Component line={line}/>;
};

const CommandLineInline = ({line}: {line: CommandLine}) => (
  <span className={styles.inline}>
    <code>
      <LineComponent line={line}/>
    </code>
  </span>
);

const CommandLineBlock = ({lines}: {lines: Array<CommandLine>}) => (
  <pre className={styles.block}>
    <code>
      {lines.map((line, index) => <div key={index}><LineComponent line={line}/></div>)}
    </code>
  </pre>
);

export function CommandLineHighlight({type, lines}: {type: `code` | `inlineCode`, lines: Array<CommandLine>}) {
  if (type === `inlineCode`) {
    return <CommandLineInline line={lines[0]}/>;
  } else {
    return <CommandLineBlock lines={lines}/>;
  }
}
