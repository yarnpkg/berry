import {Fetcher, FetchOptions, MinimalFetchOptions} from '@yarnpkg/core';
import {Locator, MessageName}                       from '@yarnpkg/core';
import {httpUtils, structUtils, tgzUtils}           from '@yarnpkg/core';
import semver                                       from 'semver';
import {URL}                                        from 'url';

import {PROTOCOL}                                   from './constants';
import * as npmConfigUtils                          from './npmConfigUtils';

export class NpmHttpFetcher implements Fetcher {
  supports(locator: Locator, opts: MinimalFetchOptions) {
    if (!locator.reference.startsWith(PROTOCOL))
      return false;

    const url = new URL(locator.reference);

    if (!semver.valid(url.pathname))
      return false;
    if (!url.searchParams.has(`archiveUrl`))
      return false;

    return true;
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
        opts.report.reportInfoOnce(MessageName.FETCH_NOT_CACHED, `${structUtils.prettyLocator(opts.project.configuration, locator)} can't be found in the cache and will be fetched from the remote server`);
        return await this.fetchFromNetwork(locator, opts);
      },
    );

    return {
      packageFs,
      releaseFs,
      prefixPath: npmConfigUtils.getVendorPath(locator),
      checksum,
    };
  }

  async fetchFromNetwork(locator: Locator, opts: FetchOptions) {
    const archiveUrl = new URL(locator.reference).searchParams.get(`archiveUrl`);
    if (archiveUrl === null)
      throw new Error(`Assertion failed: The archiveUrl querystring parameter should have been available`);

    const sourceBuffer = await httpUtils.get(archiveUrl, {
      configuration: opts.project.configuration,
    });

    return await tgzUtils.convertToZip(sourceBuffer, {
      stripComponents: 1,
      prefixPath: npmConfigUtils.getVendorPath(locator),
    });
  }
}
