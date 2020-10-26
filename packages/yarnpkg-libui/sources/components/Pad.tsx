import chalk                  from 'chalk';
import {Text}                 from 'ink';
import React, {memo, useMemo} from 'react';

export interface PadProps {
  length: number
  active: boolean
}
export const Pad = memo(({length, active}: PadProps) => {
  const text = useMemo(() => chalk.underline(` `.padEnd(length, ` `)), [length, active]);
  return <Text dimColor={!active}>{text}</Text>;
});
