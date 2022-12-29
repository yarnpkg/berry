import algoliasearch from 'algoliasearch/lite';

// Note that the appId and appKey are specific to Yarn's website - please
// don't use them anywhere else without asking Algolia's permission
const ALGOLIA_API_KEY = `f54e21fa3a2a0160595bb058179bfb1e`;
const ALGOLIA_APP_ID = `OFCNCOG2CU`;

export const searchClient = algoliasearch(
  ALGOLIA_APP_ID,
  ALGOLIA_API_KEY,
);
