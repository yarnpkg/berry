import {PortablePath, xfs}                                   from '@yarnpkg/fslib';
import {ExtendOptions, RequestError, Response, TimeoutError} from 'got';
import {Agent as HttpsAgent}                                 from 'https';
import {Agent as HttpAgent}                                  from 'http';
import micromatch                                            from 'micromatch';
import tunnel, {ProxyOptions}                                from 'tunnel';
import {URL}                                                 from 'url';

import {ConfigurationValueMap, Configuration}                from './Configuration';
import {MessageName}                                         from './MessageName';
import {ReportError}                                         from './Report';
import * as formatUtils                                      from './formatUtils';
import {MapValue, MapValueToObjectValue}                     from './miscUtils';
import * as miscUtils                                        from './miscUtils';

export {RequestError} from 'got';

const cache = new Map<string, Promise<Buffer> | Buffer>();
const fileCache = new Map<PortablePath, Promise<Buffer> | Buffer>();

const globalHttpAgent = new HttpAgent({keepAlive: true});
const globalHttpsAgent = new HttpsAgent({keepAlive: true});

function parseProxy(specifier: string) {
  const url = new URL(specifier);
  const proxy: ProxyOptions = {host: url.hostname, headers: {}};

  if (url.port)
    proxy.port = Number(url.port);

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

async function prettyNetworkError(response: Promise<Response<any>>, {configuration, customErrorMessage}: {configuration: Configuration, customErrorMessage?: (err: RequestError) => string | null}) {
  try {
    return await response;
  } catch (err) {
    if (err.name !== `HTTPError`)
      throw err;

    let message = customErrorMessage?.(err) ?? err.response.body?.error;

    if (message == null) {
      if (err.message.startsWith(`Response code`)) {
        message = `The remote server failed to provide the requested resource`;
      } else {
        message = err.message;
      }
    }

    if (err instanceof TimeoutError && err.event === `socket`)
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
    caFilePath: undefined,
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
  customErrorMessage?: (err: RequestError) => string | null;
  headers?: {[headerName: string]: string};
  jsonRequest?: boolean;
  jsonResponse?: boolean;
  method?: Method;
};

export async function request(target: string | URL, body: Body, {configuration, headers, jsonRequest, jsonResponse, method = Method.GET}: Omit<Options, 'customErrorMessage'>) {
  const realRequest = async () => await requestImpl(target, body, {configuration, headers, jsonRequest, jsonResponse, method});

  const executor = await configuration.reduceHook(hooks => {
    return hooks.wrapNetworkRequest;
  }, realRequest, {target, body, configuration, headers, jsonRequest, jsonResponse, method});

  return await executor();
}

export async function get(target: string, {configuration, jsonResponse, ...rest}: Options) {
  let entry = miscUtils.getFactoryWithDefault(cache, target, () => {
    return prettyNetworkError(request(target, null, {configuration, ...rest}), {configuration}).then(response => {
      cache.set(target, response.body);
      return response.body;
    });
  });

  if (Buffer.isBuffer(entry) === false)
    entry = await entry;

  if (jsonResponse) {
    return JSON.parse(entry.toString());
  } else {
    return entry;
  }
}

export async function put(target: string, body: Body, {customErrorMessage, ...options}: Options): Promise<Buffer> {
  const response = await prettyNetworkError(request(target, body, {...options, method: Method.PUT}), options);

  return response.body;
}

export async function post(target: string, body: Body, {customErrorMessage, ...options}: Options): Promise<Buffer> {
  const response = await prettyNetworkError(request(target, body, {...options, method: Method.POST}), options);

  return response.body;
}

export async function del(target: string, {customErrorMessage, ...options}: Options): Promise<Buffer> {
  const response = await prettyNetworkError(request(target, null, {...options, method: Method.DELETE}), options);

  return response.body;
}

async function requestImpl(target: string | URL, body: Body, {configuration, headers, jsonRequest, jsonResponse, method = Method.GET}: Omit<Options, 'customErrorMessage'>) {
  const url = typeof target === `string` ? new URL(target) : target;

  const networkConfig = getNetworkSettings(url, {configuration});
  if (networkConfig.enableNetwork === false)
    throw new Error(`Request to '${url.href}' has been blocked because of your configuration settings`);

  if (url.protocol === `http:` && !micromatch.isMatch(url.hostname, configuration.get(`unsafeHttpWhitelist`)))
    throw new Error(`Unsafe http requests must be explicitly whitelisted in your configuration (${url.hostname})`);

  const agent = {
    http: networkConfig.httpProxy
      ? tunnel.httpOverHttp(parseProxy(networkConfig.httpProxy))
      : globalHttpAgent,
    https: networkConfig.httpsProxy
      ? tunnel.httpsOverHttp(parseProxy(networkConfig.httpsProxy)) as HttpsAgent
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
  const httpsCertFilePath = networkConfig.httpsCertFilePath;
  const httpsKeyFilePath = networkConfig.httpsKeyFilePath;

  const {default: got} = await import(`got`);

  const certificateAuthority = caFilePath
    ? await getCachedFile(caFilePath)
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
    return gotClient(url) as unknown as Response<any>;
  });
}
