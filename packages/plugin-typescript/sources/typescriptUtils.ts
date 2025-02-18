import type {EndRequest, Requester, Response} from '@algolia/client-common';
import {Configuration, Descriptor}            from '@yarnpkg/core';
import {httpUtils, structUtils}               from '@yarnpkg/core';
import {algoliasearch}                        from 'algoliasearch';

// Note that the appId and appKey are specific to Yarn's plugin-typescript - please
// don't use them anywhere else without asking Algolia's permission
const ALGOLIA_API_KEY = `e8e1bd300d860104bb8c58453ffa1eb4`;
const ALGOLIA_APP_ID = `OFCNCOG2CU`;

interface AlgoliaObj {
  types?: {
    ts?: string;
  };
}

export const hasDefinitelyTyped = async (
  descriptor: Descriptor,
  configuration: Configuration,
) => {
  const stringifiedIdent = structUtils.stringifyIdent(descriptor);
  const algoliaClient = createAlgoliaClient(configuration);

  try {
    const packageInfo = await algoliaClient.getObject({indexName: `npm-search`, objectID: stringifiedIdent, attributesToRetrieve: [`types`]}) as AlgoliaObj;

    return packageInfo.types?.ts === `definitely-typed`;
  } catch {
    return false;
  }
};

const createAlgoliaClient = (configuration: Configuration) => {
  const requester: Requester = {
    async send(request: EndRequest): Promise<Response> {
      try {
        const response = await httpUtils.request(request.url, request.data || null, {
          configuration,
          headers: request.headers,
        });

        return {
          content: response.body,
          isTimedOut: false,
          status: response.statusCode,
        };
      } catch (error) {
        return {
          content: error.response.body,
          isTimedOut: false,
          status: error.response.statusCode,
        };
      }
    }};

  return algoliasearch(ALGOLIA_APP_ID, ALGOLIA_API_KEY, {requester});
};
