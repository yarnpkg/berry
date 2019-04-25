import HttpAgent, {HttpsAgent} from 'agentkeepalive';
import got                     from 'got';
import tunnel, {ProxyOptions}  from 'tunnel';
import {URL}                   from 'url';

import {Configuration}         from './Configuration';

const cache = new Map<string, Promise<Buffer>>();

const globalHttpAgent = new HttpAgent();
const globalHttpsAgent = new HttpsAgent();

function parseProxy(specifier: string) {
  const url = new URL(specifier);
  const proxy: ProxyOptions = {host: url.hostname, headers: {}};

  if (url.port)
    proxy.port = Number(url.port);

  return {proxy};
}

export interface Options {
  headers?: {[headerName: string]: string};
}

async function getNoCache(target: string, configuration: Configuration, options: Options = {}): Promise<Buffer> {
  if (!configuration.get(`enableNetwork`))
    throw new Error(`Network access have been disabled by configuration (when querying ${target})`);

  const url = new URL(target);
  let agent;

  const httpProxy = configuration.get(`httpProxy`);
  const httpsProxy = configuration.get(`httpsProxy`);

  if (url.protocol === `http:`)
    agent = httpProxy
      ? tunnel.httpOverHttp(parseProxy(httpProxy))
      : globalHttpAgent;

  if (url.protocol === `https:`)
    agent = httpsProxy
      ? tunnel.httpsOverHttp(parseProxy(httpsProxy))
      : globalHttpsAgent;

  const res = await got(target, {...options, agent, encoding: null});

  if (res.statusCode !== 200)
    throw new Error(`The remote server answered with an HTTP ${res.statusCode} (when querying ${target})`);

  return await res.body;
}

export function get(target: string, configuration: Configuration, options?: Options): Promise<Buffer> {
  let entry = cache.get(target);

  if (!entry) {
    entry = getNoCache(target, configuration, options);
    cache.set(target, entry);
  }

  return entry;
}
