import {useKeypress} from './useKeypress';

export const useListInput = function <T>(value: T, values: Array<T>, {active, minus, plus, set, loop = true}: {active: boolean, minus: string, plus: string, set: (value: T) => void, loop?: boolean}) {
  useKeypress({active}, (ch, key) => {
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
  }, [values, value, plus, set, loop]);
};
