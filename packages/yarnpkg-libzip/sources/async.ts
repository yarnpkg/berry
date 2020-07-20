import {Libzip, makeInterface} from './makeInterface';

let promise: Promise<Libzip> | null = null;

export function getLibzipSync() {
  throw new Error(`Cannot use getLibzipSync when using the async version of the libzip`);
}

export async function getLibzipPromise() {
  if (promise === null) {
    promise = new Promise<Libzip>(resolve => {
      require(`./libzipAsync`).then((libzip: EmscriptenModule) => {
        resolve(makeInterface(libzip));
      });
    });
  }
}

export type {Libzip} from './makeInterface';
