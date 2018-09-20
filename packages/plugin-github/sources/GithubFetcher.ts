import {Archive, Fetcher}                 from '@berry/core';
import {httpUtils, structUtils, tgzUtils} from '@berry/core';
import {Locator}                          from '@berry/core';

import * as githubUtils                   from './githubUtils';

export class GithubFetcher implements Fetcher {
  supports(locator: Locator): boolean {
    return githubUtils.isGithubUrl(locator.reference);
  }

  async fetch(locator: Locator): Promise<Archive> {
    const tgz = await httpUtils.get(this.getLocatorUrl(locator));

    return await tgzUtils.makeArchive(tgz);
  }

  getLocatorUrl(locator: Locator) {
    const {username, reponame, branch = `master`} = githubUtils.parseGithubUrl(locator.reference);
    return `https://github.com/${username}/${reponame}/archive/${branch}.tar.gz`;
  }
}
