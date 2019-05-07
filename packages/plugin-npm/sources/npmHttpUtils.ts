import {Configuration, Ident, httpUtils} from '@berry/core';
import {MessageName, ReportError}        from '@berry/core';

import * as npmConfigUtils               from './npmConfigUtils';

type AuthOptions = {
  forceAuth?: boolean,
  ident: Ident | null,
  registryUrl?: string | null,
}

export type Options = httpUtils.Options & AuthOptions;

export async function get(path: string, {configuration, headers, ident, forceAuth, registryUrl, ... rest}: Options) {
  const registry = registryUrl || npmConfigUtils.getRegistry(ident, {configuration});
  const auth = getAuthenticationHeader({configuration}, {ident, forceAuth});

  if (auth)
    headers = {... headers, authorization: auth};

  return await httpUtils.get(`${registry}${path}`, {configuration, headers, ... rest});
}

export async function put(path: string, body: httpUtils.Body, {configuration, headers, ident, forceAuth = true, registryUrl, ... rest}: Options) {
  const registry = registryUrl || npmConfigUtils.getRegistry(ident, {configuration});
  const auth = getAuthenticationHeader({configuration}, {ident, forceAuth});

  if (auth)
    headers = {... headers, authorization: auth};

  return await httpUtils.put(`${registry}${path}`, body, {configuration, headers, ... rest});
}

function getAuthenticationHeader({configuration}: {configuration: Configuration}, {ident, forceAuth}: AuthOptions) {
  const authConfiguration = npmConfigUtils.getAuthenticationConfiguration(ident, {configuration});
  const mustAuthenticate = forceAuth === undefined
    ? configuration.get(`npmAlwaysAuth`)
    : forceAuth;

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
