import {useCallback, useEffect} from 'react';
import {Key}                    from 'readline';

import {getInk}                 from '../ink';

export function useKeypress({active}: {active: boolean}, cb: (ch: string, key: Key) => void, deps: Array<any>) {
  const {stdin} = getInk().useStdin();

  const handler = useCallback((ch: string, key: Key) => {
    return cb(ch, key);
  }, deps);

  useEffect(() => {
    if (!active || !stdin)
      return undefined;

    stdin.on(`keypress`, handler);
    return () => {
      stdin.off(`keypress`, handler);
    };
  }, [
    active,
    handler,
    stdin,
  ]);
}
