import {Text} from 'ink';
import React  from 'react';

export const Gem: React.FC<{active: boolean}> = ({active}) => {
  return active ? <Text color="green">{`◉`}</Text>
    :  <Text color="yellow">{`◯`}</Text>;
};
