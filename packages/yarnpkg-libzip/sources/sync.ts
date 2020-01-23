import {Libzip, makeInterface} from './makeInterface';

let mod: Libzip | null = null;

export function getLibzipSync() {
  if (mod === null)
    mod = makeInterface(require(`./libzipSync`));

  return mod;
}

export async function getLibzipPromise() {
  return getLibzipSync();
}

export {Libzip} from './makeInterface';
