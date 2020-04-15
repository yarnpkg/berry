import styled           from '@emotion/styled';
import React            from 'react';
import tinycolor        from 'tinycolor2';

import PlaygroundButton from './PlaygroundButton';

const Result = styled(PlaygroundButton)`
  cursor: auto;
`;

const PlaygroundResults = ({label: {type, color, text, help}}) => (
  <Result style={{
    background: color,
    color: tinycolor(color).isDark() ? `#fff` : `#000`,
  }} data-tip={help} data-type={type}>
    {text}
  </Result>
);

// eslint-disable-next-line arca/no-default-export
export default PlaygroundResults;
