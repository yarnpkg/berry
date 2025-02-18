import {algoliasearch} from 'algoliasearch';

const algolia = {
  appId: `OFCNCOG2CU`,
  apiKey: `6fe4476ee5a1832882e326b506d14126`,
  indexName: `npm-search`,
};

const client = algoliasearch(algolia.appId, algolia.apiKey);

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
  page: number = 0,
) => {
  const res = await client.searchSingleIndex<AlgoliaPackage>({
    indexName: algolia.indexName,
    searchParams: {
      query,
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
    },
  });

  return res;
};
