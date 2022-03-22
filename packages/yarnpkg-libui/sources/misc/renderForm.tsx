import {useApp, render}     from 'ink';
import React                from 'react';
import {Readable, Writable} from 'stream';

import {Application}        from '../components/Application';
import {useKeypress}        from '../hooks/useKeypress';

type InferProps<T> = T extends React.ComponentType<infer P> ? P : never;

export type SubmitInjectedComponent<T, C = React.ComponentType> = React.ComponentType<InferProps<C> & { useSubmit: (value: T) => void }>;

// TODO: make the streams required in the next major so that people don't forget to pass them
export type RenderFormOptions = {
  stdin?: Readable;
  stdout?: Writable;
  stderr?: Writable;
};

export async function renderForm<T, C = React.ComponentType>(UserComponent: SubmitInjectedComponent<T, C>, props: InferProps<C>, {stdin, stdout, stderr}: RenderFormOptions = {}) {
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
    </Application>,
    {
      stdin: stdin as NodeJS.ReadStream,
      stdout: stdout as NodeJS.WriteStream,
      stderr: stderr as NodeJS.WriteStream,
    },
  );

  await waitUntilExit();
  return returnedValue;
}
