import {useStdin}              from 'ink';
import {useEffect}             from 'react';

import {attachKeypressHandler} from '../misc/attachKeypressHandler';

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


    return attachKeypressHandler(stdin, cb);
  }, [handler, stdin]);
};
