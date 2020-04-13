import {css}      from "@emotion/core";
import styled     from '@emotion/styled';
import BeatLoader from 'react-spinners/BeatLoader';
import React      from 'react';

import {STATUS}   from './constants';

const StatusContainer = styled.div`
  grid-area: status;

  text-align: center;

  height: 5.5rem;

  line-height: 1;
`;

const loaderStyle = css`
  margin: 15px auto 0;
`;

const PlaygroundStatus = ({statusState: [status]}) => (
  <StatusContainer>
    <b>Status</b>
    <br />
    <br />
    {status}
    <BeatLoader
      css={loaderStyle}
      size={12}
      color={`#41a1cc`}
      loading={status !== STATUS.READY && status !== STATUS.FINISHED && status !== STATUS.ERROR}
    />
  </StatusContainer>
);

// eslint-disable-next-line arca/no-default-export
export default PlaygroundStatus;
