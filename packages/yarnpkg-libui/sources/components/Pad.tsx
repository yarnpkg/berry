import React    from 'react';

import {getInk} from '../ink';

export interface PadProps {
  length: number;
  active: boolean;
}

export const Pad = ({length, active}: PadProps) => {
  const {Text} = getInk();

  if (length === 0)
    return null;

  const text = length > 1
    ? ` ${`-`.repeat(length - 1)}`
    : ` `;

  return <Text dimColor={!active}>{text}</Text>;
};
