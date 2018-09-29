import {Archive, Fetcher, FetchOptions}   from '@berry/core';
import {httpUtils, structUtils, tgzUtils} from '@berry/core';
import {Locator}                          from '@berry/core';

import * as githubUtils                   from './githubUtils';

export class GithubFetcher implements Fetcher {
  public mountPoint: string = `cached-fetchers`;

  supports(locator: Locator) {
    if (!githubUtils.isGithubUrl(locator.reference))
      return false;

    return true;
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    const tgz = await httpUtils.get(this.getLocatorUrl(locator, opts));

    return await tgzUtils.makeArchive(tgz);
  }

  getLocatorUrl(locator: Locator, opts: FetchOptions) {
    const {username, reponame, branch = `master`} = githubUtils.parseGithubUrl(locator.reference);

    return `https://github.com/${username}/${reponame}/archive/${branch}.tar.gz`;
  }
}
