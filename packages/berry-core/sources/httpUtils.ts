import fetch from 'node-fetch';

const cache = new Map<string, Promise<Buffer>>();

async function getNoCache(target: string): Promise<Buffer> {
  const res = await fetch(target);

  if (res.status !== 200)
    throw new Error(`Server answered status code ${res.status}`);

  return await res.buffer();
}

export function get(target: string): Promise<Buffer> {
  let entry = cache.get(target);

  if (!entry) {
    entry = getNoCache(target);
    cache.set(target, entry);
  }

  return entry;
}
