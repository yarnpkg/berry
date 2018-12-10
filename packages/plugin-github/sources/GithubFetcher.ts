import {Fetcher, FetchOptions, FetchResult, MinimalFetchOptions} from '@berry/core';
import {httpUtils, structUtils, tgzUtils}                        from '@berry/core';
import {Locator}                                                 from '@berry/core';

import * as githubUtils                                          from './githubUtils';

export class GithubFetcher implements Fetcher {
  public mountPoint: string = `cached-fetchers`;

  supports(locator: Locator, opts: MinimalFetchOptions) {
    if (!githubUtils.isGithubUrl(locator.reference))
      return false;

    return true;
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    const tgz = await httpUtils.get(this.getLocatorUrl(locator, opts), opts.project.configuration);
    const prefixPath = `node_modules/${structUtils.requirableIdent(locator)}`;

    const packageFs = await tgzUtils.makeArchive(tgz, {
      stripComponents: 1,
      prefixPath,
    });

    // Since we installed everything into a subdirectory, we need to create this symlink to instruct the cache as to which directory to use
    await packageFs.symlinkPromise(prefixPath, `berry-pkg`);

    return [packageFs, async () => packageFs.close()] as FetchResult;
  }

  private getLocatorUrl(locator: Locator, opts: MinimalFetchOptions) {
    const {username, reponame, branch = `master`} = githubUtils.parseGithubUrl(locator.reference);

    return `https://github.com/${username}/${reponame}/archive/${branch}.tar.gz`;
  }
}
