import {Configuration, Ident, httpUtils} from '@yarnpkg/core';
import {MessageName, ReportError}        from '@yarnpkg/core';
import {prompt}                          from 'enquirer';
import {URL}                             from 'url';

import * as npmConfigUtils               from './npmConfigUtils';
import {MapLike, RegistryConfiguration}  from './npmConfigUtils';

export enum AuthType {
  NO_AUTH,
  BEST_EFFORT,
  CONFIGURATION,
  ALWAYS_AUTH,
}

type AuthOptions = {
  authType?: AuthType,
};

type RegistryOptions = {
  ident: Ident,
  registry?: string,
} | {
  ident?: Ident,
  registry: string | RegistryConfiguration;
};

export type Options = httpUtils.Options & AuthOptions & RegistryOptions;

/**
 * Consumes all 401 Unauthorized errors and reports them as `AUTHENTICATION_INVALID`.
 *
 * It doesn't handle 403 Forbidden, as the npm registry uses it when the user attempts
 * a prohibited action, such as publishing a package with a similar name to an existing package.
 */
export async function handleInvalidAuthenticationError(error: any, {attemptedAs, registry, headers, configuration}: {attemptedAs?: string, registry: string, headers: {[key: string]: string} | undefined, configuration: Configuration}) {
  if (error.name === `HTTPError` && error.response.statusCode === 401) {
    throw new ReportError(MessageName.AUTHENTICATION_INVALID, `Invalid authentication (${typeof attemptedAs !== `string` ? `as ${await whoami(registry, headers, {configuration})}` : `attempted as ${attemptedAs}`})`);
  }
}

export function getIdentUrl(ident: Ident) {
  if (ident.scope) {
    return `/@${ident.scope}%2f${ident.name}`;
  } else {
    return `/${ident.name}`;
  }
}

export async function get(path: string, {configuration, headers, ident, authType, registry, ...rest}: Options) {
  const registryConfiguration = getRegistryConfiguration({configuration, ident, registry});
  const registryServer = registryConfiguration.get(`npmRegistryServer`);

  if (ident && ident.scope && typeof authType === `undefined`)
    authType = AuthType.BEST_EFFORT;

  const auth = getAuthenticationHeader(registryConfiguration, {authType});
  if (auth)
    headers = {...headers, authorization: auth};

  let url;
  try {
    url = new URL(path);
  } catch (e) {
    url = new URL(registryServer + path);
  }

  try {
    return await httpUtils.get(url.href, {configuration, headers, ...rest});
  } catch (error) {
    await handleInvalidAuthenticationError(error, {
      registry: registryServer,
      configuration,
      headers,
    });

    throw error;
  }
}

export async function post(path: string, body: httpUtils.Body, {attemptedAs, configuration, headers, ident, authType = AuthType.ALWAYS_AUTH, registry, ...rest}: Options & {attemptedAs?: string}) {
  const registryConfiguration = getRegistryConfiguration({configuration, ident, registry});
  const registryServer = registryConfiguration.get(`npmRegistryServer`);

  const auth = getAuthenticationHeader(registryConfiguration, {authType});
  if (auth)
    headers = {...headers, authorization: auth};

  try {
    return await httpUtils.post(registryServer + path, body, {configuration, headers, ...rest});
  } catch (error) {
    if (!isOtpError(error)) {
      await handleInvalidAuthenticationError(error, {attemptedAs, registry: registryServer, configuration, headers});

      throw error;
    }

    const otp = await askForOtp();
    const headersWithOtp = {...headers, ...getOtpHeaders(otp)};

    // Retrying request with OTP
    try {
      return await httpUtils.post(`${registryServer}${path}`, body, {configuration, headers: headersWithOtp, ...rest});
    } catch (error) {
      await handleInvalidAuthenticationError(error, {attemptedAs, registry: registryServer, configuration, headers});

      throw error;
    }
  }
}

export async function put(path: string, body: httpUtils.Body, {attemptedAs, configuration, headers, ident, authType = AuthType.ALWAYS_AUTH, registry, ...rest}: Options & {attemptedAs?: string}) {
  const registryConfiguration = getRegistryConfiguration({configuration, ident, registry});
  const registryServer = registryConfiguration.get(`npmRegistryServer`);

  const auth = getAuthenticationHeader(registryConfiguration, {authType});
  if (auth)
    headers = {...headers, authorization: auth};

  try {
    return await httpUtils.put(registryServer + path, body, {configuration, headers, ...rest});
  } catch (error) {
    if (!isOtpError(error)) {
      await handleInvalidAuthenticationError(error, {attemptedAs, registry: registryServer, configuration, headers});

      throw error;
    }

    const otp = await askForOtp();
    const headersWithOtp = {...headers, ...getOtpHeaders(otp)};

    // Retrying request with OTP
    try {
      return await httpUtils.put(`${registryServer}${path}`, body, {configuration, headers: headersWithOtp, ...rest});
    } catch (error) {
      await handleInvalidAuthenticationError(error, {attemptedAs, registry: registryServer, configuration, headers});

      throw error;
    }
  }
}

export async function del(path: string, {attemptedAs, configuration, headers, ident, authType = AuthType.ALWAYS_AUTH, registry, ...rest}: Options & {attemptedAs?: string}) {
  const registryConfiguration = getRegistryConfiguration({configuration, ident, registry});
  const registryServer = registryConfiguration.get(`npmRegistryServer`);

  const auth = getAuthenticationHeader(registryConfiguration, {authType});
  if (auth)
    headers = {...headers, authorization: auth};

  try {
    return await httpUtils.del(registryServer + path, {configuration, headers, ...rest});
  } catch (error) {
    if (!isOtpError(error)) {
      await handleInvalidAuthenticationError(error, {attemptedAs, registry: registryServer, configuration, headers});

      throw error;
    }

    const otp = await askForOtp();
    const headersWithOtp = {...headers, ...getOtpHeaders(otp)};

    // Retrying request with OTP
    try {
      return await httpUtils.del(`${registryServer}${path}`, {configuration, headers: headersWithOtp, ...rest});
    } catch (error) {
      await handleInvalidAuthenticationError(error, {attemptedAs, registry: registryServer, configuration, headers});

      throw error;
    }
  }
}

function getRegistryConfiguration({configuration, ident, registry}: Pick<Options, 'configuration' | 'ident' | 'registry'>): RegistryConfiguration {
  if (typeof registry === `undefined`)
    return ident
      ? npmConfigUtils.getScopeRegistryConfiguration(ident.scope, {configuration})
      : npmConfigUtils.getDefaultRegistryConfiguration({configuration});
  if (typeof registry === `string`)
    return npmConfigUtils.getEffectiveRegistryConfiguration(registry, {configuration});
  return registry;
}

function getAuthenticationHeader(registryConfiguration: RegistryConfiguration, {authType = AuthType.CONFIGURATION}: {authType?: AuthType}) {
  const mustAuthenticate = shouldAuthenticate(registryConfiguration, authType);

  if (!mustAuthenticate)
    return null;

  if (registryConfiguration.get(`npmAuthToken`))
    return `Bearer ${registryConfiguration.get(`npmAuthToken`)}`;
  if (registryConfiguration.get(`npmAuthIdent`))
    return `Basic ${registryConfiguration.get(`npmAuthIdent`)}`;

  if (mustAuthenticate && authType !== AuthType.BEST_EFFORT) {
    throw new ReportError(MessageName.AUTHENTICATION_NOT_FOUND ,`No authentication configured for request`);
  } else {
    return null;
  }
}

function shouldAuthenticate(authConfiguration: MapLike, authType: AuthType) {
  switch (authType) {
    case AuthType.CONFIGURATION:
      return authConfiguration.get(`npmAlwaysAuth`);

    case AuthType.BEST_EFFORT:
    case AuthType.ALWAYS_AUTH:
      return true;

    case AuthType.NO_AUTH:
      return false;

    default:
      throw new Error(`Unreachable`);
  }
}

async function whoami(registry: string, headers: {[key: string]: string} | undefined, {configuration}: {configuration: Configuration}) {
  if (typeof headers === `undefined` || typeof headers.authorization === `undefined` )
    return `an anonymous user`;

  try {
    const response = await httpUtils.get(new URL(`${registry}/-/whoami`).href, {
      configuration,
      headers,
      jsonResponse: true,
    });

    return response.username ?? `an unknown user`;
  } catch {
    return `an unknown user`;
  }
}

async function askForOtp() {
  if (process.env.TEST_ENV)
    return process.env.TEST_NPM_2FA_TOKEN || ``;

  const {otp} = await prompt<{otp: string}>({
    type: `password`,
    name: `otp`,
    message: `One-time password:`,
    required: true,
    onCancel: () => process.exit(130),
  });

  return otp;
}

function isOtpError(error: any) {
  if (error.name !== `HTTPError`)
    return false;

  try {
    const authMethods = error.response.headers[`www-authenticate`].split(/,\s*/).map((s: string) => s.toLowerCase());
    return authMethods.includes(`otp`);
  } catch (e) {
    return false;
  }
}

function getOtpHeaders(otp: string) {
  return {
    [`npm-otp`]: otp,
  };
}
