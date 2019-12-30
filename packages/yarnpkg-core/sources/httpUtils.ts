import got, {GotOptions, NormalizedOptions, Response} from 'got';
import {Agent as HttpsAgent}                          from 'https';
import {Agent as HttpAgent}                           from 'http';
import micromatch                                     from 'micromatch';
import tunnel, {ProxyOptions}                         from 'tunnel';
import {URL}                                          from 'url';

import {Configuration}                                from './Configuration';

const cache = new Map<string, Promise<Buffer>>();

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
  if (url.protocol === `http:` && !micromatch.isMatch(url.hostname, configuration.get(`unsafeHttpWhitelist`)))
    throw new Error(`Unsafe http requests must be explicitly whitelisted in your configuration (${url.hostname})`);

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

  const gotOptions: GotOptions = {agent, headers, method};
  let hostname: string | undefined;

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

  const makeHooks = () => ({
    beforeRequest: [
      (options: NormalizedOptions) => {
        hostname = options.hostname;
      },
    ],
    beforeRedirect: [
      (options: NormalizedOptions) => {
        if (options.headers && options.headers.authorization && options.hostname !== hostname) {
          delete options.headers.authorization;
        }
      },
    ],
  });

  //@ts-ignore
  const gotClient = got.extend({
    retry: 10,
    ...gotOptions,
    hooks: makeHooks(),
  });

  const res = await gotClient(target) as Response<any>;
  return await res.body;
}

export async function get(target: string, {configuration, json, ...rest}: Options) {
  let entry = cache.get(target);

  if (!entry) {
    entry = request(target, null, {configuration, ...rest});
    cache.set(target, entry);
  }

  if (json) {
    return await entry.then(buffer => JSON.parse(buffer.toString()));
  } else {
    return await entry;
  }
}

export async function put(target: string, body: Body, options: Options): Promise<Buffer> {
  return await request(target, body, {...options, method: Method.PUT});
}
