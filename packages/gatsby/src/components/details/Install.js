import React    from 'react';
import styled   from '@emotion/styled';

import Copyable from './Copyable';

const InstallBox = styled.article`
  color: #117cad;
  margin-bottom: 2em;

  h1 {
    color: #5a5a5a;
    margin-top: 0;
    margin-bottom: .5rem;
    font-weight: 600;
    font-size: 1.2em;
    line-height: 1.1;
  }

  button {
    background: none;
    color: inherit;
    border: none;
    font: inherit;
    cursor: pointer;
  }

  a:hover {
    color: #0a4a67;
    text-decoration: underline;
  }
`;

const InstallCommand = styled.div`
  display: flex;
  width: 100%;
  background-color: #eceeef;
  padding: 1em;
  margin: 0.5em 0 0.5em;

  code {
    line-height: 1.5;
    flex-grow: 1;
    background: none;
    font-size: 90%;
    color: #666666;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-size-adjust: 100%;
  }
`;

const Install = ({ name, onOpenFileBrowser }) => (
  <InstallBox>
    <h1>Use it</h1>
    <InstallCommand>
      <Copyable pre="$ " tag="code">
        yarn add {name}
      </Copyable>
    </InstallCommand>
    <div>
      <a
        href={`https://runkit.com/npm/${name}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Try in RunKit
      </a>
      {' · '}
      <button onClick={onOpenFileBrowser}>
        Browse Files
      </button>
    </div>
  </InstallBox>
);

export default Install;
