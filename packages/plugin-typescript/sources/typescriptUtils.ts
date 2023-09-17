import {Configuration, Descriptor} from '@yarnpkg/core';
import {httpUtils, structUtils}    from '@yarnpkg/core';

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

  const algoliaClient = httpUtils.createAlgoliaClient(configuration);
  const index = algoliaClient.initIndex(`npm-search`);

  try {
    const packageInfo = await index.getObject<AlgoliaObj>(stringifiedIdent, {attributesToRetrieve: [`types`]});

    return packageInfo.types?.ts === `definitely-typed`;
  } catch (_e) {
    return false;
  }
};
