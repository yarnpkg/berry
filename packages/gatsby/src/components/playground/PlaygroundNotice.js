import styled          from '@emotion/styled';
import codesandboxIcon from '@iconify/icons-logos/codesandbox';
import {InlineIcon}    from '@iconify/react';
import React           from 'react';

const Notice = styled.a`
  display: flex;
  align-items: center;

  margin-left: auto;

  color: #1e1e1e;
  font-size: 90%;
  font-weight: 500;
`;

const PlaygroundNotice = () => (
  <Notice href={`https://codesandbox.io`} target={`_blank`}>
    Powered by CodeSandbox
    <InlineIcon
      icon={codesandboxIcon}
      width={`2.2em`}
      height={`1.5em`}
    />
  </Notice>
);

// eslint-disable-next-line arca/no-default-export
export default PlaygroundNotice;
