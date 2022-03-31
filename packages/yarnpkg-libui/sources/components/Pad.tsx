import {Text} from 'ink';
import React  from 'react';

export interface PadProps {
  length: number;
  active: boolean;
}

export const Pad = ({length, active}: PadProps) => {
  if (length === 0)
    return null;

  const text = length > 1
    ? ` ${`-`.repeat(length - 1)}`
    : ` `;

  return <Text dimColor={!active}>{text}</Text>;
};
