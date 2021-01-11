import {ConfigurationValueMap}           from '@yarnpkg/core';
import {PortablePath, xfs}               from '@yarnpkg/fslib';
import {ExtendOptions}                   from 'got';
import {Agent as HttpsAgent}             from 'https';
import {Agent as HttpAgent}              from 'http';
import micromatch                        from 'micromatch';
import tunnel, {ProxyOptions}            from 'tunnel';
import {URL}                             from 'url';

import {Configuration}                   from './Configuration';
import {MapValue, MapValueToObjectValue} from './miscUtils';

const cache = new Map<string, Promise<Buffer> | Buffer>();
const certCache = new Map<PortablePath, Promise<Buffer> | Buffer>();

let defaultAgents: {
  http: HttpAgent;
  https: HttpsAgent;
};

function getDefaultAgents() {
  if (typeof defaultAgents !== `undefined`)
    return defaultAgents;

  const http = new HttpAgent({keepAlive: true});
  const https = new HttpsAgent({keepAlive: true});

  const agents = {https, http};
  defaultAgents = agents;

  return agents;
}

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

  type NetworkSettingsType = MapValueToObjectValue<MapValue<ConfigurationValueMap['networkSettings']>>;
  type UndefinableSettings = { [P in keyof NetworkSettingsType]: NetworkSettingsType[P] | undefined; };

  const mergedNetworkSettings: UndefinableSettings = {
    enableNetwork: undefined,
    caFilePath: undefined,
    httpProxy: undefined,
    httpsProxy: undefined,
  };

  const mergableKeys = Object.keys(mergedNetworkSettings) as Array<keyof NetworkSettingsType>;

  const url = new URL(target);
  for (const [glob, config] of networkSettings) {
    if (micromatch.isMatch(url.hostname, glob)) {
      for (const key of mergableKeys) {
        const setting = config.get(key);
        if (setting !== null && typeof mergedNetworkSettings[key] === `undefined`) {
          mergedNetworkSettings[key] = setting as any;
        }
      }
    }
  }

  // Apply defaults
  for (const key of mergableKeys) {
    if (typeof mergedNetworkSettings[key] === `undefined`) {
      mergedNetworkSettings[key] = opts.configuration.get(key) as any;
    }
  }

  return mergedNetworkSettings as NetworkSettingsType;
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

export type Response = {
  statusCode: number;
  body: any;
};

export async function request(target: string, body: Body, {configuration, headers, jsonRequest, jsonResponse, method = Method.GET}: Options): Promise<Response> {
  const networkConfig = getNetworkSettings(target, {configuration});
  if (networkConfig.enableNetwork === false)
    throw new Error(`Request to '${target}' has been blocked because of your configuration settings`);

  const url = new URL(target);
  if (url.protocol === `http:` && !micromatch.isMatch(url.hostname, configuration.get(`unsafeHttpWhitelist`)))
    throw new Error(`Unsafe http requests must be explicitly whitelisted in your configuration (${url.hostname})`);

  async function requestViaFetch(): Promise<Response> {
    if (networkConfig.httpProxy || networkConfig.httpsProxy)
      throw new Error(`Proxies aren't supported when networkApi is set to 'fetch'`);

    if (typeof fetch === `undefined`)
      throw new Error(`The networkApi setting is set to 'fetch', but the fetch API isn't available`);

    const defaultHeaders: Record<string, string> = {};

    let finalBody: BodyInit | null;
    if (body === null || typeof body === `string` || Buffer.isBuffer(body)) {
      finalBody = body;
    } else {
      if (jsonRequest) {
        defaultHeaders[`Content-Type`] = `application/json`;
        finalBody = JSON.stringify(body);
      } else {
        const formData = new FormData();
        for (const [key, value] of Object.entries(body))
          formData.set(key, value);
        finalBody = formData;
      }
    }

    const res = await fetch(target, {
      method,
      body: finalBody,
      headers: {...defaultHeaders, ...headers},
    });

    const stream = jsonResponse
      ? res.json()
      : res.arrayBuffer().then(arrayBuffer => Buffer.from(arrayBuffer));

    return stream.then(body => ({
      statusCode: res.status,
      body,
    }));
  }

  async function requestViaGot(): Promise<Response> {
    const agent = {
      http: networkConfig.httpProxy
        ? tunnel.httpOverHttp(parseProxy(networkConfig.httpProxy))
        : getDefaultAgents().http,
      https: networkConfig.httpsProxy
        ? tunnel.httpsOverHttp(parseProxy(networkConfig.httpsProxy)) as HttpsAgent
        : getDefaultAgents().https,
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

    return got.extend({
      timeout: {
        socket: socketTimeout,
      },
      retry,
      https: {
        rejectUnauthorized,
        certificateAuthority,
      },
      ...gotOptions,
    })(target);
  }

  return configuration.getLimit(`networkConcurrency`)(() => {
    if (configuration.get(`networkApi`) === `fetch`) {
      return requestViaFetch();
    } else {
      return requestViaGot();
    }
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
