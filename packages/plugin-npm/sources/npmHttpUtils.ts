import {Configuration, Ident, httpUtils} from '@berry/core';
import {MessageName, ReportError}        from '@berry/core';
import inquirer                          from 'inquirer';

import * as npmConfigUtils               from './npmConfigUtils';
import {MapLike}                         from './npmConfigUtils';

export enum AuthType {
  NO_AUTH,
  CONFIGURATION,
  ALWAYS_AUTH,
};

type AuthOptions = {
  authType?: AuthType,
  ident: Ident | null,
}

export type Options = httpUtils.Options & AuthOptions;

export async function get(path: string, {configuration, headers, ident, authType, ... rest}: Options) {
  const registry = npmConfigUtils.getRegistry(ident, {configuration});
  const auth = getAuthenticationHeader({configuration}, {ident, authType});

  if (auth)
    headers = {... headers, authorization: auth};

  return await httpUtils.get(`${registry}${path}`, {configuration, headers, ... rest});
}

export async function put(path: string, body: httpUtils.Body, {configuration, headers, ident, authType = AuthType.ALWAYS_AUTH, ... rest}: Options) {
  const registry = npmConfigUtils.getRegistry(ident, {configuration});
  const auth = getAuthenticationHeader({configuration}, {ident, authType});

  if (auth)
    headers = {... headers, authorization: auth};

  try {
    const response = await httpUtils.put(`${registry}${path}`, body, {configuration, headers, ... rest});

    return response;
  } catch(error) {
    if (requestRequiresOtp(error)) {
      const otp = await askForOtp();
      const headersWithOtp = {... headers, ... getOtpHeaders(otp)};

      // Retrying request with OTP
      return await httpUtils.put(`${registry}${path}`, body, {configuration, headers: headersWithOtp, ... rest});
    }

    throw error;
  }
}

function getAuthenticationHeader({configuration}: {configuration: Configuration}, {ident, authType = AuthType.CONFIGURATION}: AuthOptions) {
  const authConfiguration = npmConfigUtils.getAuthenticationConfiguration(ident, {configuration});
  const mustAuthenticate = shouldAuthenticate(authConfiguration, authType);

  if (!mustAuthenticate && (!ident || !ident.scope))
    return null;

  if (authConfiguration.get(`npmAuthToken`))
    return `Bearer ${authConfiguration.get(`npmAuthToken`)}`;
  if (authConfiguration.get(`npmAuthIdent`))
    return `Basic ${authConfiguration.get(`npmAuthIdent`)}`;

  if (mustAuthenticate) {
    throw new ReportError(MessageName.AUTHENTICATION_NOT_FOUND ,`No authentication configured for request`);
  } else {
    return null;
  }
}

function shouldAuthenticate(authConfiguration: MapLike, authType: AuthType) {
  switch (authType) {
    case AuthType.CONFIGURATION:
      return authConfiguration.get(`npmAlwaysAuth`);

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

  const { otp } = await prompt({
    type: `input`,
    name: `otp`,
    message: `One-time password:`,
    validate: (input: string) => input.length > 0 ? true : `One-time password is required`,
  });

  return otp as string;
}

function requestRequiresOtp(error: any) {
  try {
    const authMethods = error.headers['www-authenticate'].split(/,\s*/).map((s: string) => s.toLowerCase());

    return authMethods.includes('otp');
  } catch(e) {
    return false;
  }
}

function getOtpHeaders(otp: string) {
  return {
    [`npm-otp`]: otp,
  };
}
