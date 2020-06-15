import got, {ExtendOptions, Response} from 'got';
import {Agent as HttpsAgent}          from 'https';
import {Agent as HttpAgent}           from 'http';
import micromatch                     from 'micromatch';
import plimit                         from 'p-limit';
import tunnel, {ProxyOptions}         from 'tunnel';
import {URL}                          from 'url';

import {Configuration}                from './Configuration';

const NETWORK_CONCURRENCY = 8;

const limit = plimit(NETWORK_CONCURRENCY);

const cache = new Map<string, Promise<Buffer> | Buffer>();

const globalHttpAgent = new HttpAgent({keepAlive: true});
const globalHttpsAgent = new HttpsAgent({keepAlive: true});

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
  GET = `GET`,
  PUT = `PUT`,
}

export type Options = {
  configuration: Configuration,
  headers?: {[headerName: string]: string};
  json?: boolean,
  method?: Method,
};

export async function request(target: string, body: Body, {configuration, headers, json, method = Method.GET}: Options) {
  if (!configuration.get(`enableNetwork`))
    throw new Error(`Network access have been disabled by configuration (${method} ${target})`);

  const url = new URL(target);
  if (url.protocol === `http:` && !micromatch.isMatch(url.hostname, configuration.get(`unsafeHttpWhitelist`)))
    throw new Error(`Unsafe http requests must be explicitly whitelisted in your configuration (${url.hostname})`);

  const httpProxy = configuration.get(`httpProxy`);
  const httpsProxy = configuration.get(`httpsProxy`);
  const agent = {
    http: httpProxy
      ? tunnel.httpOverHttp(parseProxy(httpProxy))
      : globalHttpAgent,
    https: httpsProxy
      ? tunnel.httpsOverHttp(parseProxy(httpsProxy)) as HttpsAgent
      : globalHttpsAgent,
  };


  const gotOptions: ExtendOptions = {agent, headers, method};

  gotOptions.responseType = json
    ? `json`
    : `buffer`;

  if (body !== null) {
    if (typeof body === `string` || Buffer.isBuffer(body)) {
      gotOptions.body = body;
    } else {
      gotOptions.json = body;
    }
  }

  const timeout = configuration.get(`httpTimeout`);
  const retry = configuration.get(`httpRetry`);

  //@ts-ignore
  const gotClient = got.extend({
    timeout,
    retry,
    ...gotOptions,
  });

  return limit(() => gotClient(target) as unknown as Response<any>);
}

export async function get(target: string, {configuration, json, ...rest}: Options) {
  let entry = cache.get(target);

  if (!entry) {
    entry = request(target, null, {configuration, ...rest}).then(response => {
      cache.set(target, response.body);
      return response.body;
    });
    cache.set(target, entry);
  }

  if (Buffer.isBuffer(entry) === false)
    entry = await entry;

  if (json) {
    return JSON.parse(entry.toString());
  } else {
    return entry;
  }
}

export async function put(target: string, body: Body, options: Options): Promise<Buffer> {
  const response = await request(target, body, {...options, method: Method.PUT});

  return response.body;
}
