import {setFactory, getInstance, tryInstance} from './instance';
import {Libzip, makeInterface}                from './makeInterface';

export * from './common';

let promise: Promise<Libzip> | undefined;

setFactory(() => {
  throw new Error(`Zip methods must be called within the context of getLibzipPromise when operating under async-only environments`);
});

export function getLibzipSync() {
  return getInstance();
}

export async function getLibzipPromise() {
  const instance = tryInstance();
  if (typeof instance !== `undefined`)
    return instance;

  if (typeof promise !== `undefined`)
    return promise;

  return promise = import(`./libzipAsync`).then(async ({default: createModule}) => {
    const emZip = await createModule();
    const libzip = makeInterface(emZip);

    promise = undefined;

    setFactory(() => libzip);
    return getInstance();
  });
}
