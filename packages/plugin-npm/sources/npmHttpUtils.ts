import {Configuration, httpUtils, Ident} from '@berry/core';
import {MessageName, ReportError}        from '@berry/core';

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
  const mustAuthenticate = configuration.get(`npmAlwaysAuth`);

  if (!mustAuthenticate && !ident.scope)
    return null;

  if (configuration.get(`npmAuthToken`))
    return `Bearer ${configuration.get(`npmAuthToken`)}`;

  if (configuration.get(`npmAuthIdent`))
    return `Basic ${configuration.get(`npmAuthIdent`)}`;

  if (mustAuthenticate) {
    throw new ReportError(MessageName.AUTHENTICATION_NOT_FOUND ,`No authentication configured for request`);
  } else {
    return null;
  }
}
