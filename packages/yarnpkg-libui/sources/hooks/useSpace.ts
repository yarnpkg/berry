import {useStdin}  from 'ink';
import {useEffect} from 'react';

const keypress = require(`keypress`);

export type SpaceHandler =
  () => void;

export const useSpace = function ({active, handler}: {active: boolean, handler: SpaceHandler}) {
  const {stdin} = useStdin();

  useEffect(() => {
    if (!active)
      return undefined;


    const cb = (ch: any, key: any) => {
      if (key.name === `space`) {
        handler();
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
  }, [handler, stdin]);
};
