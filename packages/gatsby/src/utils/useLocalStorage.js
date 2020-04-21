import _useLocalStorage from 'react-use-localstorage';

// eslint-disable-next-line arca/no-default-export
export default function useLocalStorage (key, initialValue)  {
  return typeof window !== `undefined`
    ? _useLocalStorage(key, initialValue)
    : [initialValue, () => undefined];
};
