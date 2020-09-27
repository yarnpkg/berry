import {StdinContext}                                    from 'ink';
import React, {useContext, useEffect, useMemo, useState} from 'react';

export const MinistoreContext = React.createContext<{
  getAll: () => Map<string, any>,
  get: (key: string) => any,
  set: (key: string, value: any) => void,
} | null>(null);

export const Application = ({children}: {children: React.ReactElement}) => {
  const {setRawMode} = useContext(StdinContext);

  useEffect(() => {
    setRawMode && setRawMode(true);
  }, []);

  const [data, setData] = useState(new Map());

  const ministore = useMemo(() => ({
    getAll: () => data,
    get: (key: string) => data.get(key),
    set: (key: string, value: any) => setData(new Map([...data, [key, value]])),
  }), [data, setData]);

  return <MinistoreContext.Provider value={ministore} children={children} />;
};
