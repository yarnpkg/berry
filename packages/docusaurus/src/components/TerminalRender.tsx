import CodeBlock from '@theme/CodeBlock';
import React     from 'react';

export function TerminalRender({command, content}: {command: string, content: string}) {
  return (
    <div className={`terminal-code terminal-render`}>
      <CodeBlock>
        <div dangerouslySetInnerHTML={{__html: content}}/>
      </CodeBlock>
    </div>
  );
}
