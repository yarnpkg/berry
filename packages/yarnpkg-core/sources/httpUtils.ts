import type * as AlgoliaTypes                              from '@algolia/requester-common';
import {PortablePath, xfs}                                 from '@yarnpkg/fslib';
import type {ExtendOptions, RequestError}                  from 'got';
import {type Agent as HttpsAgent}                          from 'https';
import {type Agent as HttpAgent, type IncomingHttpHeaders} from 'http';
import micromatch                                          from 'micromatch';
import {type ProxyOptions}                                 from 'tunnel';
import {URL}                                               from 'url';

import {ConfigurationValueMap, Configuration}              from './Configuration';
import {MessageName}                                       from './MessageName';
import {WrapNetworkRequestInfo}                            from './Plugin';
import {ReportError}                                       from './Report';
import * as formatUtils                                    from './formatUtils';
import {MapValue, MapValueToObjectValue}                   from './miscUtils';
import * as miscUtils                                      from './miscUtils';

export type {RequestError}                                   from 'got';

const cache = new Map<string, any>();
const fileCache = new Map<PortablePath, Promise<Buffer> | Buffer>();

let agents: {
  http: HttpAgent;
  https: HttpsAgent;
} | null = null;

function getDefaultAgents() {
  if (agents !== null)
    return agents;

  const {Agent: HttpAgent} = require(`http`) as typeof import('http');
  const {Agent: HttpsAgent} = require(`https`) as typeof import('https');

  const http = new HttpAgent({keepAlive: true});
  const https = new HttpsAgent({keepAlive: true});

  return agents = {http, https};
}

function parseProxy(specifier: string) {
  const url = new URL(specifier);
  const proxy: ProxyOptions = {host: url.hostname, headers: {}};

  if (url.port)
    proxy.port = Number(url.port);

  if (url.username && url.password)
    proxy.proxyAuth = `${url.username}:${url.password}`;

  return {proxy};
}

async function getCachedFile(filePath: PortablePath) {
  return miscUtils.getFactoryWithDefault(fileCache, filePath, () => {
    return xfs.readFilePromise(filePath).then(file => {
      fileCache.set(filePath, file);
      return file;
    });
  });
}

function prettyResponseCode({statusCode, statusMessage}: Response, configuration: Configuration) {
  const prettyStatusCode = formatUtils.pretty(configuration, statusCode, formatUtils.Type.NUMBER);
  const href = `https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/${statusCode}`;

  return formatUtils.applyHyperlink(configuration, `${prettyStatusCode}${statusMessage ? ` (${statusMessage})` : ``}`, href);
}

async function prettyNetworkError(response: Promise<Response>, {configuration, customErrorMessage}: {configuration: Configuration, customErrorMessage?: (err: RequestError, configuration: Configuration) => string | null}) {
  try {
    return await response;
  } catch (err) {
    if (err.name !== `HTTPError`)
      throw err;

    let message = customErrorMessage?.(err, configuration) ?? err.response.body?.error;

    if (message == null) {
      if (err.message.startsWith(`Response code`)) {
        message = `The remote server failed to provide the requested resource`;
      } else {
        message = err.message;
      }
    }

    if (err.code === `ETIMEDOUT` && err.event === `socket`)
      message += `(can be increased via ${formatUtils.pretty(configuration, `httpTimeout`, formatUtils.Type.SETTING)})`;

    const networkError = new ReportError(MessageName.NETWORK_ERROR, message, report => {
      if (err.response) {
        report.reportError(MessageName.NETWORK_ERROR, `  ${formatUtils.prettyField(configuration, {
          label: `Response Code`,
          value: formatUtils.tuple(formatUtils.Type.NO_HINT, prettyResponseCode(err.response, configuration)),
        })}`);
      }

      if (err.request) {
        report.reportError(MessageName.NETWORK_ERROR, `  ${formatUtils.prettyField(configuration, {
          label: `Request Method`,
          value: formatUtils.tuple(formatUtils.Type.NO_HINT, err.request.options.method),
        })}`);

        report.reportError(MessageName.NETWORK_ERROR, `  ${formatUtils.prettyField(configuration, {
          label: `Request URL`,
          value: formatUtils.tuple(formatUtils.Type.URL, err.request.requestUrl),
        })}`);
      }

      if (err.request.redirects.length > 0) {
        report.reportError(MessageName.NETWORK_ERROR, `  ${formatUtils.prettyField(configuration, {
          label: `Request Redirects`,
          value: formatUtils.tuple(formatUtils.Type.NO_HINT, formatUtils.prettyList(configuration, err.request.redirects, formatUtils.Type.URL)),
        })}`);
      }

      if (err.request.retryCount === err.request.options.retry.limit) {
        report.reportError(MessageName.NETWORK_ERROR, `  ${formatUtils.prettyField(configuration, {
          label: `Request Retry Count`,
          value: formatUtils.tuple(formatUtils.Type.NO_HINT, `${formatUtils.pretty(configuration, err.request.retryCount, formatUtils.Type.NUMBER)} (can be increased via ${formatUtils.pretty(configuration, `httpRetry`, formatUtils.Type.SETTING)})`),
        })}`);
      }
    });

    networkError.originalError = err;
    throw networkError;
  }
}

/**
 * Searches through networkSettings and returns the most specific match
 */
export function getNetworkSettings(target: string | URL, opts: { configuration: Configuration }) {
  // Sort the config by key length to match on the most specific pattern
  const networkSettings = [...opts.configuration.get(`networkSettings`)].sort(([keyA], [keyB]) => {
    return keyB.length - keyA.length;
  });

  type NetworkSettingsType = MapValueToObjectValue<MapValue<ConfigurationValueMap['networkSettings']>>;
  type UndefinableSettings = { [P in keyof NetworkSettingsType]: NetworkSettingsType[P] | undefined; };

  const mergedNetworkSettings: UndefinableSettings = {
    enableNetwork: undefined,
    httpsCaFilePath: undefined,
    httpProxy: undefined,
    httpsProxy: undefined,
    httpsKeyFilePath: undefined,
    httpsCertFilePath: undefined,
  };

  const mergableKeys = Object.keys(mergedNetworkSettings) as Array<keyof NetworkSettingsType>;

  const url = typeof target === `string` ? new URL(target) : target;
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
  for (const key of mergableKeys)
    if (typeof mergedNetworkSettings[key] === `undefined`)
      mergedNetworkSettings[key] = opts.configuration.get(key) as any;

  return mergedNetworkSettings as NetworkSettingsType;
}

export type Response = {
  body: any;
  headers: IncomingHttpHeaders;
  statusCode: number;
  statusMessage?: string;
};

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
  configuration: Configuration;
  customErrorMessage?: (err: RequestError, configuration: Configuration) => string | null;
  headers?: {[headerName: string]: string | undefined};
  jsonRequest?: boolean;
  jsonResponse?: boolean;
  method?: Method;
  wrapNetworkRequest?: (executor: () => Promise<Response>, extra: WrapNetworkRequestInfo) => Promise<() => Promise<Response>>;
};

export async function request(target: string | URL, body: Body, {configuration, headers, jsonRequest, jsonResponse, method = Method.GET, wrapNetworkRequest}: Omit<Options, 'customErrorMessage'>) {
  const options = {target, body, configuration, headers, jsonRequest, jsonResponse, method};

  const realRequest = async () => await requestImpl(target, body, options);

  const wrappedRequest = typeof wrapNetworkRequest !== `undefined`
    ? await wrapNetworkRequest(realRequest, options)
    : realRequest;

  const executor = await configuration.reduceHook(hooks => {
    return hooks.wrapNetworkRequest;
  }, wrappedRequest, options);

  return await executor();
}

export async function get(target: string, {configuration, jsonResponse, customErrorMessage, wrapNetworkRequest, ...rest}: Options) {
  const runRequest = () => prettyNetworkError(request(target, null, {configuration, wrapNetworkRequest, ...rest}), {configuration, customErrorMessage})
    .then(response => response.body);

  // We cannot cache responses when wrapNetworkRequest is used, as it can differ between calls
  const entry = await (
    typeof wrapNetworkRequest !== `undefined`
      ? runRequest()
      : miscUtils.getFactoryWithDefault(cache, target, () => {
        return runRequest().then(body => {
          cache.set(target, body);
          return body;
        });
      })
  );

  if (jsonResponse) {
    return JSON.parse(entry.toString());
  } else {
    return entry;
  }
}

export async function put(target: string, body: Body, {customErrorMessage, ...options}: Options): Promise<Buffer> {
  const response = await prettyNetworkError(request(target, body, {...options, method: Method.PUT}), {customErrorMessage, configuration: options.configuration});

  return response.body;
}

export async function post(target: string, body: Body, {customErrorMessage, ...options}: Options): Promise<Buffer> {
  const response = await prettyNetworkError(request(target, body, {...options, method: Method.POST}), {customErrorMessage, configuration: options.configuration});

  return response.body;
}

export async function del(target: string, {customErrorMessage, ...options}: Options): Promise<Buffer> {
  const response = await prettyNetworkError(request(target, null, {...options, method: Method.DELETE}), {customErrorMessage, configuration: options.configuration});

  return response.body;
}

async function requestImpl(target: string | URL, body: Body, {configuration, headers, jsonRequest, jsonResponse, method = Method.GET}: Omit<Options, 'customErrorMessage'>): Promise<Response> {
  const url = typeof target === `string` ? new URL(target) : target;

  const networkConfig = getNetworkSettings(url, {configuration});
  if (networkConfig.enableNetwork === false)
    throw new ReportError(MessageName.NETWORK_DISABLED, `Request to '${url.href}' has been blocked because of your configuration settings`);

  if (url.protocol === `http:` && !micromatch.isMatch(url.hostname, configuration.get(`unsafeHttpWhitelist`)))
    throw new ReportError(MessageName.NETWORK_UNSAFE_HTTP, `Unsafe http requests must be explicitly whitelisted in your configuration (${url.hostname})`);

  const defaultAgent = getDefaultAgents();
  const tunnel = require(`tunnel`) as typeof import('tunnel');

  const agent = {
    http: networkConfig.httpProxy
      ? tunnel.httpOverHttp(parseProxy(networkConfig.httpProxy))
      : defaultAgent.http,
    https: networkConfig.httpsProxy
      ? tunnel.httpsOverHttp(parseProxy(networkConfig.httpsProxy)) as HttpsAgent
      : defaultAgent.https,
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
  const httpsCaFilePath = networkConfig.httpsCaFilePath;
  const httpsCertFilePath = networkConfig.httpsCertFilePath;
  const httpsKeyFilePath = networkConfig.httpsKeyFilePath;

  const {default: got} = await import(`got`);

  const certificateAuthority = httpsCaFilePath
    ? await getCachedFile(httpsCaFilePath)
    : undefined;
  const certificate = httpsCertFilePath
    ? await getCachedFile(httpsCertFilePath)
    : undefined;
  const key = httpsKeyFilePath
    ? await getCachedFile(httpsKeyFilePath)
    : undefined;

  const gotClient = got.extend({
    timeout: {
      socket: socketTimeout,
    },
    retry,
    https: {
      rejectUnauthorized,
      certificateAuthority,
      certificate,
      key,
    },
    ...gotOptions,
  });

  return configuration.getLimit(`networkConcurrency`)(() => {
    return gotClient(url);
  });
}

/* @internal */
export function createAlgoliaClient(configuration: Configuration) {
  const requester: AlgoliaTypes.Requester = {
    async send(req: AlgoliaTypes.Request): Promise<AlgoliaTypes.Response> {
      try {
        const res = await request(req.url, req.data || null, {
          configuration,
          headers: req.headers,
        });

        return {
          content: res.body,
          isTimedOut: false,
          status: res.statusCode,
        };
      } catch (error) {
        return {
          content: error.response.body,
          isTimedOut: false,
          status: error.response.statusCode,
        };
      }
    },
  };

  // Note that the appId and appKey are specific to Yarn's plugin-typescript - please
  // don't use them anywhere else without asking Algolia's permission
  const ALGOLIA_API_KEY = `e8e1bd300d860104bb8c58453ffa1eb4`;
  const ALGOLIA_APP_ID = `OFCNCOG2CU`;

  const algoliasearch = require(`algoliasearch`) as typeof import('algoliasearch').default;
  return algoliasearch(ALGOLIA_APP_ID, ALGOLIA_API_KEY, {requester});
}
