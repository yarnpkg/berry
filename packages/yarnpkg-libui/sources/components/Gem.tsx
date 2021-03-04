import {Text, TextProps}      from 'ink';
import React, {memo, useMemo} from 'react';

export interface GemProps {
  active: boolean
  activeColor?: TextProps['color']
}
export const Gem: React.FC<GemProps> = memo(({active, activeColor = `green`}) => {
  const text = useMemo(() => active ? `◉` : `◯`, [active]);
  const color = useMemo(() => active ? activeColor : `yellow`, [active, activeColor]);
  return <Text color={color}>{text}</Text>;
});
