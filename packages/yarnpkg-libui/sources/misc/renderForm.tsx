import {useApp, render} from 'ink';
import React            from 'react';

import {Application}    from '../components/Application';
import {useKeypress}    from '../hooks/useKeypress';

type InferProps<T> = T extends React.ComponentType<infer P> ? P : never;

export type SubmitInjectedComponent<T, C = React.ComponentType> = React.ComponentType<InferProps<C> & { useSubmit: (value: T) => void }>;

export async function renderForm<T, C = React.ComponentType>(UserComponent: SubmitInjectedComponent<T, C>, props: InferProps<C>) {
  let returnedValue: T | undefined;

  const useSubmit = (value: T) => {
    const {exit} = useApp();

    useKeypress({active: true}, (ch, key) => {
      if (key.name !== `return`)
        return;

      returnedValue = value;
      exit();
    }, [
      exit,
      value,
    ]);
  };

  const {waitUntilExit} = render(
    <Application>
      <UserComponent {...props} useSubmit={useSubmit}/>
    </Application>
  );

  await waitUntilExit();
  return returnedValue;
}
