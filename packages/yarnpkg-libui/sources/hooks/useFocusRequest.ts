import {useStdin}              from 'ink';
import {useEffect}             from 'react';

import {attachKeypressHandler} from '../misc/attachKeypressHandler';

export enum FocusRequest {
  BEFORE = `before`,
  AFTER = `after`,
}

export type FocusRequestHandler =
  (request: FocusRequest) => void;

export const useFocusRequest = function ({active, handler}: {active: boolean, handler?: FocusRequestHandler}) {
  const {stdin} = useStdin();

  useEffect(() => {
    if (!active || typeof handler === `undefined`)
      return undefined;

    const cb = (ch: any, key: any) => {
      if (key.name === `tab`) {
        if (key.shift) {
          handler(FocusRequest.BEFORE);
        } else {
          handler(FocusRequest.AFTER);
        }
      }
    };


    return attachKeypressHandler(stdin, cb);
  }, [active, handler, stdin]);
};
