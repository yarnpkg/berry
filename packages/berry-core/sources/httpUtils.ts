import got = require('got');

const cache = new Map<string, Promise<Buffer>>();

async function getNoCache(target: string): Promise<Buffer> {
  const res = await got(target, {encoding: null});

  if (res.statusCode !== 200)
    throw new Error(`Server answered status code ${res.statusCode}`);

  return await res.body;
}

export function get(target: string): Promise<Buffer> {
  let entry = cache.get(target);

  if (!entry) {
    entry = getNoCache(target);
    cache.set(target, entry);
  }

  return entry;
}
