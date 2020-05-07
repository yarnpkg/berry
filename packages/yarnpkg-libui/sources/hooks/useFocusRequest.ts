import {StdinContext}          from 'ink';
import {useContext, useEffect} from 'react';

export enum FocusRequest {
  BEFORE = `before`,
  AFTER = `after`,
}

export type FocusRequestHandler =
  (request: FocusRequest) => void;

export const useFocusRequest = function ({active, handler}: {active: boolean, handler?: FocusRequestHandler}) {
  const {stdin} = useContext(StdinContext);

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

    stdin.on(`keypress`, cb);
    return () => {
      stdin.off(`keypress`, cb);
    };
  }, [active, handler]);
};
