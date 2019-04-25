import {Configuration, httpUtils, Ident} from '@berry/core';

export function get(url: string, ident: Ident, configuration: Configuration) {
  const headers: {[headerName: string]: string} = {};

  const auth = getAuthenticationHeader(ident, configuration);
  if (auth)
    headers.authorization = auth;

  return httpUtils.get(
      url,
      configuration,
      {headers},
  );
}

function getAuthenticationHeader(ident: Ident, configuration: Configuration) {
  if (!configuration.get(`npmAlwaysAuth`) && !ident.scope)
    return undefined;

  if (configuration.get(`npmAuthToken`))
    return `Bearer ${configuration.get(`npmAuthToken`)}`;

  if (configuration.get(`npmAuthIdent`))
    return `Basic ${configuration.get(`npmAuthIdent`)}`;

  throw new Error(`No authentication configured for request`);
}