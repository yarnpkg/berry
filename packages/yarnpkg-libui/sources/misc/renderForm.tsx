import {AppContext, StdinContext, render} from 'ink';
import React, {useContext, useEffect}     from 'react';

import {Application}                      from '../components/Application';

type InferProps<T> = T extends React.ComponentType<infer P> ? P : never;

export type SubmitInjectedComponent<T, C = React.ComponentType> = React.ComponentType<InferProps<C> & { useSubmit: (value: T) => void }>;

export async function renderForm<T, C = React.ComponentType>(UserComponent: SubmitInjectedComponent<T, C>, props: InferProps<C>) {
  let returnedValue: T | undefined;

  const useSubmit = (value: T) => {
    const {exit} = useContext(AppContext);
    const {stdin} = useContext(StdinContext);

    useEffect(() => {
      const cb = (ch: any, key: any) => {
        if (key.name === `return`) {
          returnedValue = value;
          exit();
        }
      };

      stdin.on(`keypress`, cb);
      return () => {
        stdin.off(`keypress`, cb);
      };
    }, [stdin, exit, value]);
  };

  const {waitUntilExit} = render(
    <Application>
      <UserComponent {...props} useSubmit={useSubmit}/>
    </Application>
  );

  await waitUntilExit();
  return returnedValue;
}
