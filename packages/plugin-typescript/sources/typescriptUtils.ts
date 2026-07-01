import {Request, Requester, Response}        from '@algolia/requester-common';
import {Configuration, Descriptor}           from '@yarnpkg/core';
import {formatUtils, httpUtils, structUtils} from '@yarnpkg/core';
import algoliasearch                         from 'algoliasearch';

// Note that the appId and appKey are specific to Yarn's plugin-typescript - please
// don't use them anywhere else without asking Algolia's permission
const ALGOLIA_API_KEY = `e8e1bd300d860104bb8c58453ffa1eb4`;
const ALGOLIA_APP_ID = `OFCNCOG2CU`;

// Maximum time (in milliseconds) we're willing to wait for Algolia to tell us
// whether a package ships its types through DefinitelyTyped. Without this cap a
// restricted network (eg. a corporate proxy that silently drops the request)
// would make `yarn add` hang indefinitely.
// See https://github.com/yarnpkg/berry/issues/7111
const ALGOLIA_TIMEOUT = 10000;

interface AlgoliaObj {
  types?: {
    ts?: string;
  };
}

class AlgoliaTimeoutError extends Error {
  constructor() {
    super(`Timed out after ${ALGOLIA_TIMEOUT}ms`);
  }
}

export const hasDefinitelyTyped = async (
  descriptor: Descriptor,
  configuration: Configuration,
) => {
  const stringifiedIdent = structUtils.stringifyIdent(descriptor);
  const algoliaClient = createAlgoliaClient(configuration);
  const index = algoliaClient.initIndex(`npm-search`);

  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const packageInfo = await Promise.race([
      index.getObject<AlgoliaObj>(stringifiedIdent, {attributesToRetrieve: [`types`]}),
      new Promise<never>((resolve, reject) => {
        timeout = setTimeout(() => {
          reject(new AlgoliaTimeoutError());
        }, ALGOLIA_TIMEOUT);
      }),
    ]);

    return packageInfo.types?.ts === `definitely-typed`;
  } catch (error) {
    // A timeout or a network error (eg. a proxy blocking the request) shouldn't
    // prevent the package from being added - we just can't tell whether it needs
    // a matching `@types` package, so we let the user know and carry on.
    if (error instanceof AlgoliaTimeoutError || error?.name === `RetryError`)
      reportAutoTypesError(configuration, descriptor, error);

    return false;
  } finally {
    clearTimeout(timeout);
  }
};

const reportAutoTypesError = (configuration: Configuration, descriptor: Descriptor, error: Error) => {
  const prettyIdent = structUtils.prettyIdent(configuration, descriptor);

  process.emitWarning(
    `Couldn't reach the npm search registry to check whether ${prettyIdent} needs a matching @types package (${error.message}); the package will be added without it.\n` +
    `You can disable this lookup by setting ${formatUtils.pretty(configuration, `tsEnableAutoTypes`, formatUtils.Type.SETTING)} to false in your .yarnrc.yml (or by setting the YARN_TS_ENABLE_AUTO_TYPES="false" environment variable).`,
  );
};

const createAlgoliaClient = (configuration: Configuration) => {
  const requester: Requester = {
    async send(request: Request): Promise<Response> {
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
        // Connection errors (eg. a proxy refusing the request) don't always
        // carry a `response`, so we have to guard against it to avoid throwing
        // an unrelated `TypeError` from within the requester itself.
        return {
          content: error.response?.body,
          isTimedOut: error.code === `ETIMEDOUT`,
          status: error.response?.statusCode ?? 0,
        };
      }
    }};

  return algoliasearch(ALGOLIA_APP_ID, ALGOLIA_API_KEY, {requester});
};
