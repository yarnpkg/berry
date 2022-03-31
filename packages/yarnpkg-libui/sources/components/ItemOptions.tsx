import {Box, Text}    from 'ink';
import React          from 'react';

import {useListInput} from '../hooks/useListInput';

import {Gem}          from './Gem';
import {Pad}          from './Pad';

export const ItemOptions = function <T>({
  active,
  skewer,
  options,
  value,
  onChange,
  sizes = [],
}: {
  active: boolean;
  skewer?: boolean;
  options: Array<{value: T, label: string}>;
  value: T;
  onChange: (value: T) => void;
  sizes?: Array<number>;
}) {
  // Our possible values are those that have been provided with a label so that
  // the user can see what they're selecting.
  const values = options.filter(({label}) => !!label).map(({value}) => value);
  const selectedIndex = options.findIndex(o => {
    return o.value === value && o.label != ``;
  });

  useListInput(value, values, {
    active,
    minus: `left`,
    plus: `right`,
    set: onChange,
  });

  return <>
    {options.map(({label}, index) => {
      const isGemActive = index === selectedIndex;
      const boxWidth = sizes[index] - 1 || 0;

      const simpleLabel = label
        // https://stackoverflow.com/a/29497680
        // eslint-disable-next-line no-control-regex
        .replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, ``);

      const padWidth = Math.max(0, boxWidth - (simpleLabel).length - 2);

      if (!label) {
        return (
          <Box key={`spacer-${index}`} width={boxWidth} marginLeft={1}/>
        );
      }

      return (
        <Box key={label} width={boxWidth} marginLeft={1}>
          <Text wrap={`truncate`}>
            <Gem active={isGemActive} />{` `}{label}
          </Text>
          {skewer ? <Pad active={active} length={padWidth}/> : null}
        </Box>
      );
    })}
  </>;
};
