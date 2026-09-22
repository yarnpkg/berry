import {useKeypress} from './useKeypress';

export const useListInput = function <T>(value: unknown, values: Array<T>, {radius, active, minus, plus, pageminus, pageplus, set, loop = true}: {active: boolean, minus?: string, radius?: number, pageminus?: string, pageplus?: string, plus: string, set: (value: T) => void, loop?: boolean}) {
  useKeypress({active}, (ch, key) => {
    // It's fine if the value doesn't exist inside the list
    const index = values.indexOf(value as T);
    // Prevents undefined key name triggering one the potentialy undefined cases
    if (typeof key.name !== `string`)
      return;

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
      case pageminus: {
        if (!radius)
          return;
        if (radius >= values.length)
          return;

        const nextValueIndex = index - radius;

        if (loop) {
          if (nextValueIndex < 0) {
            set(values[(values.length + nextValueIndex)]);
            return;
          }
          set(values[(nextValueIndex % values.length)]);
          return;
        }

        if (nextValueIndex <= 0) {
          set(values[0]);
          return;
        }

        set(values[nextValueIndex]);
      } break;
      case pageplus: {
        if (!radius)
          return;
        if (radius >= values.length)
          return;

        const nextValueIndex = index + radius;

        if (loop) {
          set(values[nextValueIndex % values.length]);
          return;
        }

        if (nextValueIndex >= values.length) {
          set(values[values.length - 1]);
          return;
        }

        set(values[nextValueIndex]);
      } break;
    }
  }, [values, value, plus, set, loop]);
};
