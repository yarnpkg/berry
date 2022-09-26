import {setFactory, getInstance} from './instance';
import createModule              from './libzipSync';
import {makeInterface}           from './makeInterface';

export * from './common';

setFactory(() => {
  const emZip = createModule();
  return makeInterface(emZip);
});

export function getLibzipSync() {
  return getInstance();
}

export async function getLibzipPromise() {
  return getInstance();
}

export type {Libzip} from './makeInterface';
