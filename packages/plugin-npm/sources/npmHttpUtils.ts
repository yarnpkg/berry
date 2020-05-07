import {Configuration, Ident, httpUtils} from '@yarnpkg/core';
import {MessageName, ReportError}        from '@yarnpkg/core';
import inquirer                          from 'inquirer';

import * as npmConfigUtils               from './npmConfigUtils';
import {MapLike}                         from './npmConfigUtils';

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
  registry: string;
};

export type Options = httpUtils.Options & AuthOptions & RegistryOptions;

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

  const auth = getAuthenticationHeader(registry, {authType, configuration, ident});
  if (auth)
    headers = {...headers, authorization: auth};

  let url;
  try {
    url = new URL(path);
  } catch (e) {
    url = new URL(registry + path);
  }

  try {
    return await httpUtils.get(url.href, {configuration, headers, ...rest});
  } catch (error) {
    if (error.name === `HTTPError` && (error.response.statusCode === 401 || error.response.statusCode === 403)) {
      throw new ReportError(MessageName.AUTHENTICATION_INVALID, `Invalid authentication (as ${await whoami(registry, headers, {configuration})})`);
    } else {
      throw error;
    }
  }
}

export async function put(path: string, body: httpUtils.Body, {attemptedAs, configuration, headers, ident, authType = AuthType.ALWAYS_AUTH, registry, ...rest}: Options & {attemptedAs?: string}) {
  if (ident && typeof registry === `undefined`)
    registry = npmConfigUtils.getScopeRegistry(ident.scope, {configuration});

  if (typeof registry !== `string`)
    throw new Error(`Assertion failed: The registry should be a string`);

  const auth = getAuthenticationHeader(registry, {authType, configuration, ident});
  if (auth)
    headers = {...headers, authorization: auth};

  try {
    return await httpUtils.put(registry + path, body, {configuration, headers, ...rest});
  } catch (error) {
    if (!isOtpError(error)) {
      if (error.name === `HTTPError` && (error.response.statusCode === 401 || error.response.statusCode === 403)) {
        throw new ReportError(MessageName.AUTHENTICATION_INVALID, `Invalid authentication (${typeof attemptedAs !== `string` ? `as ${await whoami(registry, headers, {configuration})}` : `attempted as ${attemptedAs}`})`);
      } else {
        throw error;
      }
    }

    const otp = await askForOtp();
    const headersWithOtp = {...headers, ...getOtpHeaders(otp)};

    // Retrying request with OTP
    try {
      return await httpUtils.put(`${registry}${path}`, body, {configuration, headers: headersWithOtp, ...rest});
    } catch (error) {
      if (error.name === `HTTPError` && (error.response.statusCode === 401 || error.response.statusCode === 403)) {
        throw new ReportError(MessageName.AUTHENTICATION_INVALID, `Invalid authentication (${typeof attemptedAs !== `string` ? `as ${await whoami(registry, headersWithOtp, {configuration})}` : `attempted as ${attemptedAs}`})`);
      } else {
        throw error;
      }
    }
  }
}

function getAuthenticationHeader(registry: string, {authType = AuthType.CONFIGURATION, configuration, ident}: {authType?: AuthType, configuration: Configuration, ident: RegistryOptions['ident']}) {
  const effectiveConfiguration = npmConfigUtils.getAuthConfiguration(registry, {configuration, ident});
  const mustAuthenticate = shouldAuthenticate(effectiveConfiguration, authType);

  if (!mustAuthenticate)
    return null;

  if (effectiveConfiguration.get(`npmAuthToken`))
    return `Bearer ${effectiveConfiguration.get(`npmAuthToken`)}`;
  if (effectiveConfiguration.get(`npmAuthIdent`))
    return `Basic ${effectiveConfiguration.get(`npmAuthIdent`)}`;

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
    });

    return response.username;
  } catch {
    return `an unknown user`;
  }
}

async function askForOtp() {
  if (process.env.TEST_ENV)
    return process.env.TEST_NPM_2FA_TOKEN || ``;

  const prompt = inquirer.createPromptModule();

  const {otp} = await prompt({
    type: `input`,
    name: `otp`,
    message: `One-time password:`,
    validate: (input: string) => input.length > 0 ? true : `One-time password is required`,
  });

  return otp as string;
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
