import {Configuration, Descriptor} from '@yarnpkg/core';
import {httpUtils, structUtils}    from '@yarnpkg/core';

// Note that the appId and appKey are specific to Yarn's website - please
// don't use them anywhere else without asking Algolia's permission
const ALGOLIA_API_KEY = 'f54e21fa3a2a0160595bb058179bfb1e';
const ALGOLIA_APP_ID = 'OFCNCOG2CU';
const ALGOLIA_ENDPOINT = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/npm-search`;

export const hasDefinitelyTyped = async (
  descriptor: Descriptor,
  configuration: Configuration,
) => {
  const stringifiedIdent = structUtils.stringifyIdent(descriptor);
  const url = `${ALGOLIA_ENDPOINT}/${encodeURIComponent(stringifiedIdent)}?attributes=types`;

  try {
    const packageInfo = await httpUtils.get(url, {
      configuration,
      json: true,
      headers: {
        'X-Algolia-API-Key': ALGOLIA_API_KEY,
        'X-Algolia-Application-Id': ALGOLIA_APP_ID,
      },
    });

    return packageInfo?.types?.ts === 'definitely-typed';
  } catch (e) {
    return false;
  }
};
