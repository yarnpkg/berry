import {Configuration, httpUtils} from '@yarnpkg/core';

export interface AlgoliaPackage {
  objectID: string;
  name: string;
  version: string;
  repository?: AlgoliaPackageRepository;
  owner: AlgoliaPackageOwner;
  humanDownloadsLast30Days: string;
}

export interface AlgoliaPackageRepository {
  url: string;
}

export interface AlgoliaPackageOwner {
  name: string;
  email?: string;
  avatar: string;
  link: string;
}

export const search = async (
  query: string,
  {configuration, page = 0}: {configuration: Configuration, page?: number},
) => {
  const algoliaClient = httpUtils.createAlgoliaClient(configuration);
  const index = algoliaClient.initIndex(`npm-search`);

  const res = await index.search<AlgoliaPackage>(
    query,
    {
      analyticsTags: [`yarn-plugin-interactive-tools`],
      attributesToRetrieve: [
        `name`,
        `version`,
        `owner`,
        `repository`,
        `humanDownloadsLast30Days`,
      ],
      page,
      hitsPerPage: 10,
    });

  return res;
};
