import {PortablePath, xfs}       from '@yarnpkg/fslib';
import {ExtendOptions, Response} from 'got';
import {Agent as HttpsAgent}     from 'https';
import {Agent as HttpAgent}      from 'http';
import micromatch                from 'micromatch';
import tunnel, {ProxyOptions}    from 'tunnel';
import {URL}                     from 'url';

import {Configuration}           from './Configuration';

const cache = new Map<string, Promise<Buffer> | Buffer>();
const certCache = new Map<PortablePath, Promise<Buffer> | Buffer>();

const globalHttpAgent = new HttpAgent({keepAlive: true});
const globalHttpsAgent = new HttpsAgent({keepAlive: true});

function parseProxy(specifier: string) {
  const url = new URL(specifier);
  const proxy: ProxyOptions = {host: url.hostname, headers: {}};

  if (url.port)
    proxy.port = Number(url.port);

  return {proxy};
}

async function getCachedCertificate(caFilePath: PortablePath) {
  let certificate = certCache.get(caFilePath);

  if (!certificate) {
    certificate = xfs.readFilePromise(caFilePath).then(cert => {
      certCache.set(caFilePath, cert);
      return cert;
    });
    certCache.set(caFilePath, certificate);
  }

  return certificate;
}

/**
 * Searches through networkSettings and returns the most specific match
 */
export function getNetworkSettings(target: string, opts: { configuration: Configuration }) {
  // Sort the config by key length to match on the most specific pattern
  const networkSettings = [...opts.configuration.get(`networkSettings`)].sort(([keyA], [keyB]) => {
    return keyB.length - keyA.length;
  });

  const mergedNetworkSettings: {
    enableNetwork?: boolean,
    caFilePath?: PortablePath | null,
  } = {};

  const url = new URL(target);
  for (const [glob, config] of networkSettings) {
    if (micromatch.isMatch(url.hostname, glob)) {
      const enableNetwork = config.get(`enableNetwork`);
      if (enableNetwork !== null && typeof mergedNetworkSettings.enableNetwork === `undefined`)
        mergedNetworkSettings.enableNetwork = enableNetwork;

      const caFilePath = config.get(`caFilePath`);
      if (caFilePath !== null && typeof mergedNetworkSettings.caFilePath === `undefined`) {
        mergedNetworkSettings.caFilePath = caFilePath;
      }
    }
  }

  if (typeof mergedNetworkSettings.caFilePath === `undefined`)
    mergedNetworkSettings.caFilePath = opts.configuration.get(`caFilePath`);

  if (typeof mergedNetworkSettings.enableNetwork === `undefined`)
    mergedNetworkSettings.enableNetwork = opts.configuration.get(`enableNetwork`);

  return mergedNetworkSettings as Required<typeof mergedNetworkSettings>;
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
  /** @deprecated use jsonRequest and jsonResponse instead */
  json?: boolean;
  method?: Method,
};

export async function request(target: string, body: Body, {configuration, headers, json, jsonRequest = json, jsonResponse = json, method = Method.GET}: Options) {
  const networkConfig = getNetworkSettings(target, {configuration});
  if (networkConfig.enableNetwork === false)
    throw new Error(`Request to '${target}' has been blocked because of your configuration settings`);

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
  const rejectUnauthorized = configuration.get(`enableStrictSsl`);
  const caFilePath = networkConfig.caFilePath;

  const {default: got} = await import(`got`);

  const certificateAuthority = caFilePath
    ? await getCachedCertificate(caFilePath)
    : undefined;

  const gotClient = got.extend({
    timeout: {
      socket: socketTimeout,
    },
    retry,
    https: {
      rejectUnauthorized,
      certificateAuthority,
    },
    ...gotOptions,
  });

  return configuration.getLimit(`networkConcurrency`)(() => {
    return gotClient(target) as unknown as Response<any>;
  });
}

export async function get(target: string, {configuration, json, jsonResponse = json, ...rest}: Options) {
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
