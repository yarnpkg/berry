import {useStdin}                            from 'ink';
import React, {useEffect, useMemo, useState} from 'react';
import {emitKeypressEvents}                  from 'readline';

export const MinistoreContext = React.createContext<{
  getAll: () => Map<string, any>;
  get: (key: string) => any;
  set: (key: string, value: any) => void;
} | null>(null);

export const Application = ({children}: {children: React.ReactElement}) => {
  const {stdin, setRawMode} = useStdin();

  useEffect(() => {
    setRawMode && setRawMode(true);
    stdin && emitKeypressEvents(stdin);
  }, [stdin, setRawMode]);

  const [data, setData] = useState(new Map());

  const ministore = useMemo(() => ({
    getAll: () => data,
    get: (key: string) => data.get(key),
    set: (key: string, value: any) => setData(new Map([...data, [key, value]])),
  }), [data, setData]);

  return <MinistoreContext.Provider value={ministore} children={children} />;
};
