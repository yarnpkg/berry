import {Fetcher, FetchOptions, MinimalFetchOptions} from '@berry/core';
import {Locator, MessageName}                       from '@berry/core';
import {httpUtils, structUtils, tgzUtils}           from '@berry/core';
import {PortablePath}                               from '@berry/fslib';

import {GIT_REGEXP}                                 from './constants';
import * as gitUtils                                from './gitUtils';

export class GitFetcher implements Fetcher {
  supports(locator: Locator, opts: MinimalFetchOptions) {
    if (locator.reference.match(GIT_REGEXP))
      return true;

    return false;
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
        return await this.fetchFromNetwork(locator, opts); // TODO: This is a temp solution and will be replaced by `cloneFromRemote(...)`
      },
    );

    return {
      packageFs,
      releaseFs,
      prefixPath: `/sources` as PortablePath,
      checksum,
    };
  }

  async fetchFromNetwork(locator: Locator, opts: FetchOptions) {
    const sourceBuffer = await httpUtils.get(this.getLocatorUrl(locator, opts), {
      configuration: opts.project.configuration,
    });

    return await tgzUtils.makeArchive(sourceBuffer, {
      stripComponents: 1,
      prefixPath: `/sources` as PortablePath,
    });
  }

  private getLocatorUrl(locator: Locator, opts: MinimalFetchOptions) {
    return `https://github.com/facebook/react/archive/master.tar.gz`;
  }
}
