import styled   from '@emotion/styled';
import ansiHTML from 'ansi-html';
import React    from 'react';

const OutputContainer = styled.div`
  width: 100%;
  height: 60vh;

  padding: 10px 15px;

  overflow: scroll;
  background: #000000;

  color: white;
  white-space: pre;
  font-family: monospace;
`;

const PlaygroundOutput = ({value}) => (
  <OutputContainer dangerouslySetInnerHTML={{__html: ansiHTML(value)}} />
);

// eslint-disable-next-line arca/no-default-export
export default PlaygroundOutput;
