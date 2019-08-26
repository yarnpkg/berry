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
  registry?: void,
} | {
  ident?: void,
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
  if (ident)
    registry = npmConfigUtils.getScopeRegistry(ident.scope, {configuration});
  if (ident && ident.scope && typeof authType === `undefined`)
    authType = AuthType.BEST_EFFORT;

  if (typeof registry !== `string`)
    throw new Error(`Assertion failed: The registry should be a string`);

  const auth = getAuthenticationHeader(registry, {authType, configuration});
  if (auth)
    headers = {...headers, authorization: auth};

  return await httpUtils.get(resolveUrl(registry, path), {configuration, headers, ...rest});
}

export async function put(path: string, body: httpUtils.Body, {configuration, headers, ident, authType = AuthType.ALWAYS_AUTH, registry, ...rest}: Options) {
  if (ident)
    registry = npmConfigUtils.getScopeRegistry(ident.scope, {configuration});

  if (typeof registry !== `string`)
    throw new Error(`Assertion failed: The registry should be a string`);

  const auth = getAuthenticationHeader(registry, {authType, configuration});
  if (auth)
    headers = {...headers, authorization: auth};

  try {
    return await httpUtils.put(resolveUrl(registry, path), body, {configuration, headers, ...rest});
  } catch (error) {
    if (!isOtpError(error))
      throw error;

    const otp = await askForOtp();
    const headersWithOtp = {...headers, ...getOtpHeaders(otp)};

    // Retrying request with OTP
    return await httpUtils.put(`${registry}${path}`, body, {configuration, headers: headersWithOtp, ...rest});
  }
}

function resolveUrl(registry: string, path: string) {
  return registry.replace(/\/+$/, ``) + path;
}

function getAuthenticationHeader(registry: string, {authType = AuthType.CONFIGURATION, configuration}: {authType?: AuthType, configuration: Configuration}) {
  const registryConfiguration = npmConfigUtils.getRegistryConfiguration(registry, {configuration});
  const effectiveConfiguration = registryConfiguration || configuration;

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
  }
}

async function askForOtp() {
  if (process.env.TEST_ENV)
    return process.env.TEST_NPM_2FA_TOKEN || '';

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
  try {
    const authMethods = error.headers['www-authenticate'].split(/,\s*/).map((s: string) => s.toLowerCase());

    return authMethods.includes('otp');
  } catch (e) {
    return false;
  }
}

function getOtpHeaders(otp: string) {
  return {
    [`npm-otp`]: otp,
  };
}
