import {useContext, useCallback} from 'react';

import {MinistoreContext}        from '../components/Application';

export function useMinistore<T>(): Map<string, T>;
export function useMinistore<T>(key: string, initialValue: T): [T, (value: T) => void];

export function useMinistore<T>(key?: string, initialValue?: T) {
  const ministore = useContext(MinistoreContext);
  if (ministore === null)
    throw new Error(`Expected this hook to run with a ministore context attached`);

  if (typeof key === `undefined`)
    return ministore.getAll();

  const setValue = useCallback((newValue: T) => {
    ministore.set(key, newValue);
  }, [key, ministore.set]);

  let value = ministore.get(key);
  if (typeof value === `undefined`)
    value = initialValue;

  return [value, setValue];
}
