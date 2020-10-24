import {Text}        from 'ink';
import React, {memo} from 'react';

export interface GemProps {
  active: boolean
}
export const Gem: React.FC<GemProps> = memo(({active}) => {
  return active ? <Text color="green">{`◉`}</Text>
    :  <Text color="yellow">{`◯`}</Text>;
});
