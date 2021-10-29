import os from 'os';

let ink: typeof import('ink') | undefined;

export async function initInk() {
  if (os.endianness() === `BE`)
    throw new Error(`Interactive commands cannot be used on big-endian systems because ink depends on yoga-layout-prebuilt which only supports little-endian architectures`);

  return ink ??= await import(`ink`);
}

export function getInk() {
  if (typeof ink === `undefined`)
    throw new Error(`ink is not initialized; please call initInk to initialize it`);

  return ink;
}
