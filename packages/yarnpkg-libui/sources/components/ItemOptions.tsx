import {Box, Text}    from 'ink';
import React          from 'react';

import {useListInput} from '../hooks/useListInput';

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
      const gem = index === selectedIndex
        ? <Text color="green">{` ◉ `}</Text>
        :  <Text color="yellow">{` ◯ `}</Text>;
      return (
        <Box key={label} width={sizes[index] - 1 || 0} marginLeft={1}>
          <Text wrap="truncate">
            {gem} {label}
          </Text>
        </Box>
      );
    })}
  </>;
};
