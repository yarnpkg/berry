import styled           from '@emotion/styled';
import {BeatLoader}     from 'react-spinners';
import React            from 'react';
import tinycolor        from 'tinycolor2';

import PlaygroundButton from './PlaygroundButton';


const Status = styled(PlaygroundButton)`
  cursor: auto;
`;

const LoaderContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const PlaygroundStatus = ({label: {type, color, text, help, loading = false}}) => (
  <>
    <Status style={{
      background: color,
      color: tinycolor(color).isDark() ? `#fff` : `#000`,
    }} data-tip={help} data-type={type}>
      {text}
    </Status>
    <LoaderContainer>
      <BeatLoader color={`#41a1cc`} size={12} loading={loading} />
    </LoaderContainer>
  </>
);

// eslint-disable-next-line arca/no-default-export
export default PlaygroundStatus;
