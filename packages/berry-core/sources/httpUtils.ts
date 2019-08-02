import HttpAgent, {HttpsAgent} from 'agentkeepalive';
import got                     from 'got';
import tunnel, {ProxyOptions}  from 'tunnel';
import {URL}                   from 'url';

import {Configuration}         from './Configuration';

const cache = new Map<string, Promise<Buffer>>();

/**
 * Populated when a request is redirected, to save time on retries
 * string: The domain name that was redirected to.
 * RedirectRequires: Various request modifications that must be made
 *  for the redirected request to be made successfully.
 */
interface RedirectRequires {
  noAuth: boolean;
}
const redirectCache = new Map<string, RedirectRequires>();

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

  // Track if the request is redirected.  If it is, modifications to the request
  // might be necessary
  let didRedirect = false;
  let redirHost: string;

  const gotOptions = {agent, body, headers, json, method, encoding: null}

  //@ts-ignore
  const gotClient = got.extend({...gotOptions, hooks: {
    beforeRedirect: [
      //@ts-ignore
      (options) => {
        // Setting this flag here means that if this redirect is unsuccessful, we will cache
        // the request modifications for the redirected domain after we get the response.
        // Any time this domain gets hit with a redirect again, we will know the modifications
        // to make before the request is made.
        didRedirect = true;
        // Is there ever a time the host will be null in a redirect?  `got` thinks so.
        // I assume that if that were the case, this should probably provide some feedback
        // to the user.
        if (options.host) {
          redirHost = options.host;
          if (redirectCache.has(redirHost)) {
            // We already know the key exists in the Map, so cast to the desired type.
            const redirModReq = (redirectCache.get(redirHost) as RedirectRequires);
            // This redirect URL requires there be no `Authorization:` header.
            if (redirModReq.noAuth && options.headers && options.headers.authorization) {
              delete options.headers.authorization;
            }
          }
        }
      },
    ],
    afterResponse: [
      //@ts-ignore
      (response, retryRequest) => {
        // Only process the response if request was redirected
        if (didRedirect) {
          // Invalid request was made.  One way this has been caused is by an authorization
          // header being included in the request to the redirect URL.
          if (response.statusCode === 400) {
            // No reason to process if there is no headers authorization already
            // Only retrying if the options are being changed.  If they aren't, then
            // we don't know why this request failed...
            if (gotOptions.headers && gotOptions.headers.authorization) {
              redirectCache.set(redirHost, {
                noAuth: true,
              });
              return retryRequest(gotOptions)
            }
          }
        }
        return response;
      },
    ],
  }});

  // @ts-ignore
  // const res = await got(target, {agent, body, headers, json, method, encoding: null});
  const res = await gotClient(target);

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
