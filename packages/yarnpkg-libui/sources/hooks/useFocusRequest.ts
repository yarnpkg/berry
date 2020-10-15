import {useStdin}  from 'ink';
import {useEffect} from 'react';

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

    if (stdin != null) {
      stdin.on(`keypress`, cb);
      return () => {
        stdin.off(`keypress`, cb);
      };
    } else {
      return undefined;
    }
  }, [active, handler, stdin]);
};
