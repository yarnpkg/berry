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

export type Body = (
  {[key: string]: any} |
  string |
  Buffer |
  null
);

export enum Method {
  GET = 'GET',
  PUT = 'PUT',
};

export type Options = {
  configuration: Configuration,
  headers?: {[headerName: string]: string};
  json?: boolean,
  method?: Method,
};

async function request(target: string, body: Body, {configuration, headers, json, method = Method.GET}: Options) {
  if (!configuration.get(`enableNetwork`))
    throw new Error(`Network access have been disabled by configuration (${method} ${target})`);

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

  // @ts-ignore
  const res = await got(target, {agent, body, headers, json, method, encoding: null});

  return await res.body;
}

export function get(target: string, {configuration, json, ...rest}: Options) {
  let entry = cache.get(target);

  if (!entry) {
    entry = request(target, null, {configuration, ...rest});
    cache.set(target, entry);
  }

  if (json) {
    return entry.then(buffer => JSON.parse(buffer.toString()));
  } else {
    return entry;
  }
}

export async function put(target: string, body: Body, options: Options): Promise<Buffer> {
  return await request(target, body, {...options, method: Method.PUT});
}
