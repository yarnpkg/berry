import {Box, Text}    from 'ink';
import React          from 'react';

import {useListInput} from '../hooks/useListInput';

export const ItemOptions = function <T>({
  active,
  skewer,
  options,
  value,
  onChange,
  sizes = [],
}: {
  active: boolean,
  skewer?: boolean,
  options: Array<{value: T, label: string}>,
  value: T,
  onChange: (value: T) => void,
  sizes?: Array<number>
}) {
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
      const boxWidth = sizes[index] - 1 || 0;
      const simpleLabel = label
        // https://stackoverflow.com/a/29497680
        // eslint-disable-next-line no-control-regex
        .replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, ``);

      const padWidth = Math.max(0, boxWidth - (simpleLabel).length - 2);
      const padText = skewer ? ` `.padEnd(padWidth, `_`) : ``;

      if (index === selectedIndex) {
        return (
          <Box key={label} width={boxWidth} marginLeft={1}>
            <Text wrap="truncate">
              <Text color="green">◉</Text> <Text bold>{label}</Text>
            </Text>
            <Text dimColor={!active}>{padText}</Text>
          </Box>
        );
      } else {
        return (
          <Box key={label} width={boxWidth} marginLeft={1}>
            <Text wrap="truncate">
              <Text color="yellow">◯</Text> <Text bold>{label}</Text>
            </Text>
            <Text dimColor={!active}>{padText}</Text>
          </Box>
        );
      }
    })}
  </>;
};
