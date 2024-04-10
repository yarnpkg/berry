import CodeBlock from '@theme/CodeBlock';
import React     from 'react';

const $style = {
  fontWeight: `bold`,
  userSelect: `none`,
} as const;

export function TerminalCode({command}: {command: string}) {
  return (
    <div className={`terminal-code`}>
      <CodeBlock>
        <div>
          <span style={$style}>$ </span>{command}
        </div>
      </CodeBlock>
    </div>
  );
}
