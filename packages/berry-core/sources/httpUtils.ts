import got                    from 'got';
import tunnel, {ProxyOptions} from 'tunnel';
import {URL}                  from 'url';

import {Configuration}        from './Configuration';

const cache = new Map<string, Promise<Buffer>>();

function parseProxy(specifier: string) {
  const url = new URL(specifier);
  const proxy: ProxyOptions = {host: url.hostname, headers: {}};

  if (url.port)
    proxy.port = Number(url.port);

  return {proxy};
}

async function getNoCache(target: string, configuration: Configuration): Promise<Buffer> {
  const url = new URL(target);
  let agent;

  if (configuration.httpProxy && url.protocol === `http:`)
    agent = tunnel.httpOverHttp(parseProxy(configuration.httpProxy));

  if (configuration.httpsProxy && url.protocol === `https:`)
    agent = tunnel.httpsOverHttp(parseProxy(configuration.httpsProxy));

  const res = await got(target, {agent, encoding: null});

  if (res.statusCode !== 200)
    throw new Error(`Server answered status code ${res.statusCode}`);

  return await res.body;
}

export function get(target: string, configuration: Configuration): Promise<Buffer> {
  let entry = cache.get(target);

  if (!entry) {
    entry = getNoCache(target, configuration);
    cache.set(target, entry);
  }

  return entry;
}
