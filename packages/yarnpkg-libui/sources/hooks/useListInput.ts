import {StdinContext}          from 'ink';
import {useContext, useEffect} from 'react';

export const useListInput = function <T>(value: T, values: Array<T>, {active, minus, plus, set}: {active: boolean, minus: string, plus: string, set: (value: T) => void}) {
  const {stdin} = useContext(StdinContext);

  useEffect(() => {
    if (!active)
      return undefined;

    const cb = (ch: any, key: any) => {
      const index = values.indexOf(value);
      switch (key.name) {
        case minus: {
          set(values[(values.length + index - 1) % values.length]);
        } break;
        case plus: {
          set(values[(index + 1) % values.length]);
        } break;
      }
    };

    stdin.on(`keypress`, cb);
    return () => {
      stdin.off(`keypress`, cb);
    };
  }, [values, value, active]);
};
