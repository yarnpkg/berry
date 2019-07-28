import {Fetcher, FetchOptions, MinimalFetchOptions} from '@berry/core';
import {Locator, MessageName}                       from '@berry/core';
import {structUtils}                                from '@berry/core';

import {GIT_REGEXP}                                 from './constants';
import * as gitUtils                                from './gitUtils';

export class GitFetcher implements Fetcher {
  supports(locator: Locator, opts: MinimalFetchOptions) {
    return locator.reference.match(GIT_REGEXP);
  }

  getLocalPath(locator: Locator, opts: FetchOptions) {
    return null;
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    const expectedChecksum = opts.checksums.get(locator.locatorHash) || null;

    const [packageFs, releaseFs, checksum] = await opts.cache.fetchPackageFromCache(
      locator,
      expectedChecksum,
      async () => {
        opts.report.reportInfoOnce(MessageName.FETCH_NOT_CACHED, `${structUtils.prettyLocator(opts.project.configuration, locator)} can't be found in the cache and will be fetched from the remote repository`);
        return await this.cloneFromRemote(locator, opts);
      },
    );
  }

  async cloneFromRemote(locator: Locator, opts: FetchOptions) {
    // type GitUrl = {
    //   protocol: string;
    //   hostname: string;
    //   reponame: string;
    // };
    //
    // const gitUrl = gitUtils.parseGitUrl(locator.reference);
    // return gitUtils.clone(gitUrl)
  }
}
