import {Configuration, Ident, httpUtils} from '@berry/core';
import {MessageName, ReportError}        from '@berry/core';

import * as npmConfigUtils               from './npmConfigUtils';

export type Options = httpUtils.Options & {
  ident: Ident,
};

export async function get(url: string, {configuration, headers, ident, ... rest}: Options) {
  const auth = getAuthenticationHeader(ident, {configuration});
  if (auth)
    headers = {... headers, authorization: auth};

  return await httpUtils.get(url, {configuration, headers, ... rest});
}

export async function put(url: string, body: httpUtils.Body, {configuration, headers, ident, ... rest}: Options) {
  // We always must authenticate our PUT requests
  configuration = configuration.extend({npmAlwaysAuth: true});

  const auth = getAuthenticationHeader(ident, {configuration});
  if (auth)
    headers = {... headers, authorization: auth};

  return await httpUtils.put(url, body, {configuration, headers, ... rest});
}

function getAuthenticationHeader(ident: Ident, {configuration}: {configuration: Configuration}) {
  const authConfiguration = npmConfigUtils.getAuthenticationConfiguration(ident, configuration);
  const mustAuthenticate = authConfiguration.get(`npmAlwaysAuth`);

  if (!mustAuthenticate && !ident.scope)
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
