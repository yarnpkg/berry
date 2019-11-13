import {Box, Color}      from 'ink';
import React, {useState} from 'react';

import {useListInput}    from '../hooks/useListInput';

export const ScrollableItems = ({children = [], size = 10}: {children: Array<React.ReactElement>, size?: number}) => {
  const getKey = (child: React.ReactElement) => {
    if (child.key === null) {
      throw new Error(`Expected all children to have a key`);
    } else {
      return child.key;
    }
  };

  const keys = React.Children.map(children, child => getKey(child));
  const initialKey = keys[0];

  const [activeKey, setActiveKey] = useState(initialKey);
  const activeIndex = keys.indexOf(activeKey);

  useListInput(activeKey, keys, {
    active: true,
    minus: `up`,
    plus: `down`,
    set: setActiveKey,
  });

  let min = activeIndex - size;
  let max = activeIndex + size;

  if (max > keys.length) {
    min -= max - keys.length;
    max = keys.length;
  }

  if (min < 0) {
    max += -min;
    min = 0;
  }

  if (max > keys.length)
    max = keys.length;

  const rendered = [];

  for (let t = min; t < max; ++t) {
    const key = keys[t];
    const active = key === activeKey;

    rendered.push(<Box key={key!} height={1}>
      <Box marginLeft={2} marginRight={2}>
        {active ? <Color cyan>▶</Color> : ` `}
      </Box>
      <Box>
        {React.cloneElement(children[t], {active})}
      </Box>
    </Box>);
  }

  return <Box flexDirection={`column`} width={`100%`} height={size * 2 + 1}>
    {rendered}
  </Box>;
};
