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
  if (!configuration.get(`enableNetwork`))
    throw new Error(`Network access have been disabled by configuration (when querying ${target})`);

  const url = new URL(target);
  let agent;

  const httpProxy = configuration.get(`httpProxy`);
  const httpsProxy = configuration.get(`httpsProxy`);

  if (httpProxy && url.protocol === `http:`)
    agent = tunnel.httpOverHttp(parseProxy(httpProxy));

  if (httpsProxy && url.protocol === `https:`)
    agent = tunnel.httpsOverHttp(parseProxy(httpsProxy));

  const res = await got(target, {agent, encoding: null});

  if (res.statusCode !== 200)
    throw new Error(`The remote server answered with an HTTP ${res.statusCode} (when querying ${target})`);

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
