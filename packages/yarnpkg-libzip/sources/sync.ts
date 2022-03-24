import {Libzip, makeInterface} from './makeInterface';

let syncLibzip: Libzip | null = null;
let asyncLibzip: Promise<Libzip> | null = null;

export function getLibzipSync() {
  if (syncLibzip === null)
    syncLibzip = makeInterface(require('./libzipSync')());

  return syncLibzip;
}

export async function getLibzipPromise() {
  if (asyncLibzip === null) {
    asyncLibzip = import('./libzipAsync').then(async ({default: createModule}) => {
      const libzip = await createModule();
      return makeInterface(libzip);
    });
  }

  return asyncLibzip;
}

export type {Libzip} from './makeInterface';
