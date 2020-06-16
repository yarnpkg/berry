import {StdinContext}          from 'ink';
import {useContext, useEffect} from 'react';

export type SpaceHandler =
  () => void;

export const useSpace = function ({active, handler}: {active: boolean, handler: SpaceHandler}) {
  const {stdin} = useContext(StdinContext);

  useEffect(() => {
    if (!active)
      return undefined;


    const cb = (ch: any, key: any) => {
      if (key.name === `space`) {
        handler();
      }
    };

    stdin.on(`keypress`, cb);
    return () => {
      stdin.off(`keypress`, cb);
    };
  }, [handler]);
};
