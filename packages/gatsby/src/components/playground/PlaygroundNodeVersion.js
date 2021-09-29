import styled                       from '@emotion/styled';
import nodejsIcon                   from '@iconify/icons-logos/nodejs-icon';
import {InlineIcon}                 from '@iconify/react';
import React, {useEffect, useState} from 'react';

import * as playgroundUtils         from '../../utils/playgroundUtils';

const NodeVersion = styled.span`
  display: flex;
  align-items: center;

  color: #1e1e1e;
  font-size: 90%;
  font-weight: 500;
`;

const PlaygroundNodeVersion = ({setLabel}) => {
  const [nodeVersion, setNodeVersion] = useState(``);

  const fetchNodeVersion = async () => {
    setNodeVersion(await playgroundUtils.fetchNodeVersion({setLabel}));
  };

  useEffect(() => {
    fetchNodeVersion();
  }, []);

  return (
    <NodeVersion>
      <InlineIcon
        icon={nodejsIcon}
        width={`2.2em`}
        height={`1.5em`}
      />
      {nodeVersion}
    </NodeVersion>
  );
};

// eslint-disable-next-line arca/no-default-export
export default PlaygroundNodeVersion;
