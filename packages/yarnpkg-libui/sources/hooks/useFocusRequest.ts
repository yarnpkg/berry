import {useKeypress} from './useKeypress';

export enum FocusRequest {
  BEFORE = `before`,
  AFTER = `after`,
}

export type FocusRequestHandler =
  (request: FocusRequest) => void;

export const useFocusRequest = function ({active}: {active: boolean}, handler: FocusRequestHandler, deps: Array<any>) {
  useKeypress({active}, (ch, key) => {
    if (key.name === `tab`) {
      if (key.shift) {
        handler!(FocusRequest.BEFORE);
      } else {
        handler!(FocusRequest.AFTER);
      }
    }
  }, deps);
};
