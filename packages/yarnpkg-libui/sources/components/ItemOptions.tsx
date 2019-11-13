import {Box, Color}   from 'ink';
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
      if (index === selectedIndex) {
        return <Box key={label} minWidth={sizes[index] || 0} paddingLeft={2}><Color green>◼</Color> {label}</Box>;
      } else {
        return <Box key={label} minWidth={sizes[index] || 0} paddingLeft={2}><Color yellow>◻</Color> {label}</Box>;
      }
    })}
  </>;
};
