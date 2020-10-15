import {useStdin}  from 'ink';
import {useEffect} from 'react';

const keypress = require(`keypress`);

export const useListInput = function <T>(value: T, values: Array<T>, {active, minus, plus, set, loop = true}: {active: boolean, minus: string, plus: string, set: (value: T) => void, loop?: boolean}) {
  const {stdin} = useStdin();
  useEffect(() => {
    if (!active)
      return undefined;


    const cb = (ch: any, key: any) => {
      const index = values.indexOf(value);
      switch (key.name) {
        case minus: {
          const nextValueIndex = index - 1;

          if (loop) {
            set(values[(values.length + nextValueIndex) % values.length]);
            return;
          }

          if (nextValueIndex < 0)
            return;

          set(values[nextValueIndex]);
        } break;
        case plus: {
          const nextValueIndex = index + 1;

          if (loop) {
            set(values[nextValueIndex % values.length]);
            return;
          }

          if (nextValueIndex >= values.length)
            return;

          set(values[nextValueIndex]);
        } break;
      }
    };

    if (stdin != null) {
      keypress(stdin);
      stdin.on(`keypress`, cb);
      return () => {
        stdin.off(`keypress`, cb);
      };
    } else {
      return undefined;
    }
  }, [values, value, active, stdin]);
};
