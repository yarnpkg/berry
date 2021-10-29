import React, {memo, useMemo} from 'react';

import {getInk}               from '../ink';

export interface GemProps {
  active: boolean;
}
export const Gem: React.FC<GemProps> = memo(({active}) => {
  const {Text} = getInk();

  const text = useMemo(() => active ? `◉` : `◯`, [active]);
  const color = useMemo(() => active ? `green` : `yellow`, [active]);
  return <Text color={color}>{text}</Text>;
});
