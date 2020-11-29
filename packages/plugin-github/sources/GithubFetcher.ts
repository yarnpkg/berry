import {Fetcher, FetchOptions, MinimalFetchOptions, Locator} from '@yarnpkg/core';

import * as githubUtils                                      from './githubUtils';

export class GithubFetcher implements Fetcher {
  supports(locator: Locator, opts: MinimalFetchOptions) {
    if (!githubUtils.isGithubUrl(locator.reference))
      return false;

    return true;
  }

  getLocalPath(locator: Locator, opts: FetchOptions) {
    return null;
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    return opts.fetcher.fetch(githubUtils.makeLocator(locator), opts);
  }
}
