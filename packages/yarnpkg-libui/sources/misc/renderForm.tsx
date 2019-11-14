import {AppContext, StdinContext, render} from 'ink';
import React, {useContext, useEffect}     from 'react';

import {Application}                      from '../components/Application';

export const renderForm = async function <T>(UserComponent: any, props: any) {
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
};
