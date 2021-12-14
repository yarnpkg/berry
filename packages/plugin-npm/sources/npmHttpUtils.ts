import {Configuration, Ident, httpUtils} from '@yarnpkg/core';
import {MessageName, ReportError}        from '@yarnpkg/core';
import {prompt}                          from 'enquirer';
import {URL}                             from 'url';

import {Hooks}                           from './Hooks';
import * as npmConfigUtils               from './npmConfigUtils';
import {MapLike}                         from './npmConfigUtils';

export enum AuthType {
  NO_AUTH,
  BEST_EFFORT,
  CONFIGURATION,
  ALWAYS_AUTH,
}

type RegistryOptions = {
  ident: Ident;
  registry?: string;
} | {
  ident?: Ident;
  registry: string;
};

export type Options = httpUtils.Options & RegistryOptions & {
  authType?: AuthType;
  otp?: string;
};

/**
 * Consumes all 401 Unauthorized errors and reports them as `AUTHENTICATION_INVALID`.
 *
 * It doesn't handle 403 Forbidden, as the npm registry uses it when the user attempts
 * a prohibited action, such as publishing a package with a similar name to an existing package.
 */
export async function handleInvalidAuthenticationError(error: any, {attemptedAs, registry, headers, configuration}: {attemptedAs?: string, registry: string, headers: {[key: string]: string} | undefined, configuration: Configuration}) {
  if (isOtpError(error))
    throw new ReportError(MessageName.AUTHENTICATION_INVALID, `Invalid OTP token`);

  if (error.originalError?.name === `HTTPError` && error.originalError?.response.statusCode === 401) {
    throw new ReportError(MessageName.AUTHENTICATION_INVALID, `Invalid authentication (${typeof attemptedAs !== `string` ? `as ${await whoami(registry, headers, {configuration})}` : `attempted as ${attemptedAs}`})`);
  }
}

export function customPackageError(error: httpUtils.RequestError) {
  return error.response?.statusCode === 404 ? `Package not found` : null;
}

export function getIdentUrl(ident: Ident) {
  if (ident.scope) {
    return `/@${ident.scope}%2f${ident.name}`;
  } else {
    return `/${ident.name}`;
  }
}

export async function get(path: string, {configuration, headers, ident, authType, registry, ...rest}: Options) {
  if (ident && typeof registry === `undefined`)
    registry = npmConfigUtils.getScopeRegistry(ident.scope, {configuration});
  if (ident && ident.scope && typeof authType === `undefined`)
    authType = AuthType.BEST_EFFORT;

  if (typeof registry !== `string`)
    throw new Error(`Assertion failed: The registry should be a string`);

  const auth = await getAuthenticationHeader(registry, {authType, configuration, ident});
  if (auth)
    headers = {...headers, authorization: auth};

  try {
    return await httpUtils.get(path.charAt(0) === `/` ? `${registry}${path}` : path, {configuration, headers, ...rest});
  } catch (error) {
    await handleInvalidAuthenticationError(error, {registry, configuration, headers});

    throw error;
  }
}

export async function post(path: string, body: httpUtils.Body, {attemptedAs, configuration, headers, ident, authType = AuthType.ALWAYS_AUTH, registry, otp, ...rest}: Options & {attemptedAs?: string}) {
  if (ident && typeof registry === `undefined`)
    registry = npmConfigUtils.getScopeRegistry(ident.scope, {configuration});

  if (typeof registry !== `string`)
    throw new Error(`Assertion failed: The registry should be a string`);

  const auth = await getAuthenticationHeader(registry, {authType, configuration, ident});
  if (auth)
    headers = {...headers, authorization: auth};
  if (otp)
    headers = {...headers, ...getOtpHeaders(otp)};

  try {
    return await httpUtils.post(registry + path, body, {configuration, headers, ...rest});
  } catch (error) {
    if (!isOtpError(error) || otp) {
      await handleInvalidAuthenticationError(error, {attemptedAs, registry, configuration, headers});

      throw error;
    }

    otp = await askForOtp();
    const headersWithOtp = {...headers, ...getOtpHeaders(otp)};

    // Retrying request with OTP
    try {
      return await httpUtils.post(`${registry}${path}`, body, {configuration, headers: headersWithOtp, ...rest});
    } catch (error) {
      await handleInvalidAuthenticationError(error, {attemptedAs, registry, configuration, headers});

      throw error;
    }
  }
}

export async function put(path: string, body: httpUtils.Body, {attemptedAs, configuration, headers, ident, authType = AuthType.ALWAYS_AUTH, registry, otp, ...rest}: Options & {attemptedAs?: string}) {
  if (ident && typeof registry === `undefined`)
    registry = npmConfigUtils.getScopeRegistry(ident.scope, {configuration});

  if (typeof registry !== `string`)
    throw new Error(`Assertion failed: The registry should be a string`);

  const auth = await getAuthenticationHeader(registry, {authType, configuration, ident});
  if (auth)
    headers = {...headers, authorization: auth};
  if (otp)
    headers = {...headers, ...getOtpHeaders(otp)};

  try {
    return await httpUtils.put(registry + path, body, {configuration, headers, ...rest});
  } catch (error) {
    if (!isOtpError(error)) {
      await handleInvalidAuthenticationError(error, {attemptedAs, registry, configuration, headers});

      throw error;
    }

    otp = await askForOtp();
    const headersWithOtp = {...headers, ...getOtpHeaders(otp)};

    // Retrying request with OTP
    try {
      return await httpUtils.put(`${registry}${path}`, body, {configuration, headers: headersWithOtp, ...rest});
    } catch (error) {
      await handleInvalidAuthenticationError(error, {attemptedAs, registry, configuration, headers});

      throw error;
    }
  }
}

export async function del(path: string, {attemptedAs, configuration, headers, ident, authType = AuthType.ALWAYS_AUTH, registry, otp, ...rest}: Options & {attemptedAs?: string}) {
  if (ident && typeof registry === `undefined`)
    registry = npmConfigUtils.getScopeRegistry(ident.scope, {configuration});

  if (typeof registry !== `string`)
    throw new Error(`Assertion failed: The registry should be a string`);

  const auth = await getAuthenticationHeader(registry, {authType, configuration, ident});
  if (auth)
    headers = {...headers, authorization: auth};
  if (otp)
    headers = {...headers, ...getOtpHeaders(otp)};

  try {
    return await httpUtils.del(registry + path, {configuration, headers, ...rest});
  } catch (error) {
    if (!isOtpError(error) || otp) {
      await handleInvalidAuthenticationError(error, {attemptedAs, registry, configuration, headers});

      throw error;
    }

    otp = await askForOtp();
    const headersWithOtp = {...headers, ...getOtpHeaders(otp)};

    // Retrying request with OTP
    try {
      return await httpUtils.del(`${registry}${path}`, {configuration, headers: headersWithOtp, ...rest});
    } catch (error) {
      await handleInvalidAuthenticationError(error, {attemptedAs, registry, configuration, headers});

      throw error;
    }
  }
}

async function getAuthenticationHeader(registry: string, {authType = AuthType.CONFIGURATION, configuration, ident}: {authType?: AuthType, configuration: Configuration, ident: RegistryOptions['ident']}) {
  const effectiveConfiguration = npmConfigUtils.getAuthConfiguration(registry, {configuration, ident});
  const mustAuthenticate = shouldAuthenticate(effectiveConfiguration, authType);

  if (!mustAuthenticate)
    return null;

  const header = await configuration.reduceHook((hooks: Hooks) => {
    return hooks.getNpmAuthenticationHeader;
  }, undefined, registry, {configuration, ident});

  if (header)
    return header;

  if (effectiveConfiguration.get(`npmAuthToken`))
    return `Bearer ${effectiveConfiguration.get(`npmAuthToken`)}`;

  if (effectiveConfiguration.get(`npmAuthIdent`)) {
    const npmAuthIdent = effectiveConfiguration.get(`npmAuthIdent`);
    if (npmAuthIdent.includes(`:`))
      return `Basic ${Buffer.from(npmAuthIdent).toString(`base64`)}`;
    return `Basic ${npmAuthIdent}`;
  }

  if (mustAuthenticate && authType !== AuthType.BEST_EFFORT) {
    throw new ReportError(MessageName.AUTHENTICATION_NOT_FOUND, `No authentication configured for request`);
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
  if (typeof headers === `undefined` || typeof headers.authorization === `undefined`)
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
  if (error.originalError?.name !== `HTTPError`)
    return false;

  try {
    const authMethods = error.originalError?.response.headers[`www-authenticate`].split(/,\s*/).map((s: string) => s.toLowerCase());
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
