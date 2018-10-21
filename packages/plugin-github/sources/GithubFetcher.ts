import {Fetcher, FetchOptions, MinimalFetchOptions} from '@berry/core';
import {httpUtils, tgzUtils}                        from '@berry/core';
import {Locator, Manifest}                          from '@berry/core';

import * as githubUtils                             from './githubUtils';

export class GithubFetcher implements Fetcher {
  public mountPoint: string = `cached-fetchers`;

  supports(locator: Locator, opts: MinimalFetchOptions) {
    if (!githubUtils.isGithubUrl(locator.reference))
      return false;

    return true;
  }

  async fetchManifest(locator: Locator, opts: FetchOptions): Promise<Manifest> {
    throw new Error(`Unimplemented`);
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    const tgz = await httpUtils.get(this.getLocatorUrl(locator, opts));

    return await tgzUtils.makeArchive(tgz, {
      stripComponents: 1,
    });
  }

  private getLocatorUrl(locator: Locator, opts: MinimalFetchOptions) {
    const {username, reponame, branch = `master`} = githubUtils.parseGithubUrl(locator.reference);

    return `https://github.com/${username}/${reponame}/archive/${branch}.tar.gz`;
  }
}
