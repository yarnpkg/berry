import {ExtendOptions, Response} from 'got';
import {Agent as HttpsAgent}     from 'https';
import {Agent as HttpAgent}      from 'http';
import micromatch                from 'micromatch';
import tunnel, {ProxyOptions}    from 'tunnel';
import {URL}                     from 'url';

import {Configuration}           from './Configuration';

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
  POST = `POST`,
  DELETE = `DELETE`,
}

export type Options = {
  configuration: Configuration,
  headers?: {[headerName: string]: string};
  jsonRequest?: boolean,
  jsonResponse?: boolean,
  method?: Method,
};

export async function request(target: string, body: Body, {configuration, headers, jsonRequest, jsonResponse, method = Method.GET}: Options) {
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

  gotOptions.responseType = jsonResponse
    ? `json`
    : `buffer`;

  if (body !== null) {
    if (Buffer.isBuffer(body) || (!jsonRequest && typeof body === `string`)) {
      gotOptions.body = body;
    } else {
      // @ts-expect-error: The got types only allow an object, but got can stringify any valid JSON
      gotOptions.json = body;
    }
  }

  const socketTimeout = configuration.get(`httpTimeout`);
  const retry = configuration.get(`httpRetry`);

  const {default: got} = await import(`got`);

  //@ts-ignore
  const gotClient = got.extend({
    timeout: {
      socket: socketTimeout,
    },
    retry,
    ...gotOptions,
  });

  return configuration.getLimit(`networkConcurrency`)(() => {
    return gotClient(target) as unknown as Response<any>;
  });
}

export async function get(target: string, {configuration, jsonResponse, ...rest}: Options) {
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

  if (jsonResponse) {
    return JSON.parse(entry.toString());
  } else {
    return entry;
  }
}

export async function put(target: string, body: Body, options: Options): Promise<Buffer> {
  const response = await request(target, body, {...options, method: Method.PUT});

  return response.body;
}

export async function post(target: string, body: Body, options: Options): Promise<Buffer> {
  const response = await request(target, body, {...options, method: Method.POST});

  return response.body;
}

export async function del(target: string, options: Options): Promise<Buffer> {
  const response = await request(target, null, {...options, method: Method.DELETE});

  return response.body;
}
