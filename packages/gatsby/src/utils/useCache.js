import {useEffect, useState} from 'react';

export default function useCache(cb, dependencies) {
  const [state, setState] = useState();

  useEffect(() => {
    let cancelled = false;
    const value = cb();

    if (value && value.then) {
      value.then(realValue => {
        if (!cancelled) {
          setState(realValue);
        }
      });
    } else {
      setState(value);
    }

    return () => {
      cancelled = true;
    };
  }, dependencies)

  return state;
} 