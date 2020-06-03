import {Box, Color}                           from 'ink';
import React, {useEffect, useState}           from 'react';

import {FocusRequestHandler, useFocusRequest} from '../hooks/useFocusRequest';
import {useListInput}                         from '../hooks/useListInput';

type WillReachEnd = () => void;

export const ScrollableItems = ({active = true, children = [], radius = 10, size = 1, loop = true, onFocusRequest, willReachEnd}: {active?: boolean, children: Array<React.ReactElement>, radius?: number, size?: number, loop?: boolean, onFocusRequest?: FocusRequestHandler, willReachEnd?: WillReachEnd}) => {
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

  useEffect(() => {
    // If the active key is missing from the
    // new keys, set it to the initalKey
    if (!keys.includes(activeKey)) {
      setActiveKey(initialKey);
    }
  }, [children]);

  useEffect(() => {
    if (willReachEnd && activeIndex >= keys.length - 2) {
      willReachEnd();
    }
  }, [activeIndex]);

  useFocusRequest({
    active,
    handler: onFocusRequest,
  });

  useListInput(activeKey, keys, {
    active,
    minus: `up`,
    plus: `down`,
    set: setActiveKey,
    loop,
  });

  let min = activeIndex - radius;
  let max = activeIndex + radius;

  if (max > keys.length) {
    min -= max - keys.length;
    max = keys.length;
  }

  if (min < 0) {
    max += -min;
    min = 0;
  }

  if (max >= keys.length)
    max = keys.length - 1;

  const rendered = [];

  for (let t = min; t <= max; ++t) {
    const key = keys[t];
    const activeItem = active && key === activeKey;

    rendered.push(<Box key={key!} height={size}>
      <Box marginLeft={1} marginRight={1}>
        {activeItem ? <Color cyan bold>{`>`}</Color> : ` `}
      </Box>
      <Box>
        {React.cloneElement(children[t], {active: activeItem})}
      </Box>
    </Box>);
  }

  return <Box flexDirection={`column`} width={`100%`}>
    {rendered}
  </Box>;
};
