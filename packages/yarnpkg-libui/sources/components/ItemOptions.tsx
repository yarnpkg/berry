import {Box, Color, Text} from 'ink';
import React              from 'react';

import {useListInput}     from '../hooks/useListInput';

export const ItemOptions = function <T>({active, options, value, onChange, sizes = []}: {active: boolean, options: Array<{value: T, label: string}>, value: T, onChange: (value: T) => void, sizes?: Array<number>}) {
  const values = options.map(({value}) => value);
  const selectedIndex = values.indexOf(value);

  useListInput(value, values, {
    active,
    minus: `left`,
    plus: `right`,
    set: onChange,
  });

  return <>
    {options.map(({label}, index) => {
      if (index === selectedIndex) {
        return <Box key={label} width={sizes[index] - 1 || 0} marginLeft={1} textWrap="truncate"><Color green> ◉ </Color> <Text bold>{label}</Text></Box>;
      } else {
        return <Box key={label} width={sizes[index] - 1 || 0} marginLeft={1} textWrap="truncate"><Color yellow> ◯ </Color> <Text bold>{label}</Text></Box>;
      }
    })}
  </>;
};
