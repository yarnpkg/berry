import styled from '@emotion/styled';
import React  from 'react';

const RunButton = styled.button`
  grid-area: run;

  background: #2188b6;
  color: #fff;
  border: none;
  border-radius: 2px;
  box-shadow: 0 4px 4px 0 rgba(0,0,0,0.2);
  cursor: pointer;

  &:hover {
    background: #41a1cc;
  }

  &:active {
    background: #258cba;
  }
`;

const PlaygroundRunButton = ({runInput}) => (
  <RunButton onClick={runInput}>
    Run
  </RunButton>
);

// eslint-disable-next-line arca/no-default-export
export default PlaygroundRunButton;
