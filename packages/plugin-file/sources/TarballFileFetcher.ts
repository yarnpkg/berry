import {Fetcher, FetchOptions, MinimalFetchOptions} from '@yarnpkg/core';
import {Locator}                                    from '@yarnpkg/core';
import {structUtils, tgzUtils}                      from '@yarnpkg/core';

import {TARBALL_REGEXP, PROTOCOL}                   from './constants';
import * as fileUtils                               from './fileUtils';

export class TarballFileFetcher implements Fetcher {
  supports(locator: Locator, opts: MinimalFetchOptions) {
    if (!TARBALL_REGEXP.test(locator.reference))
      return false;

    if (locator.reference.startsWith(PROTOCOL))
      return true;

    return false;
  }

  getLocalPath(locator: Locator, opts: FetchOptions) {
    return null;
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    const expectedChecksum = opts.checksums.get(locator.locatorHash) || null;

    const [packageFs, releaseFs, checksum] = await opts.cache.fetchPackageFromCache(locator, expectedChecksum, {
      onHit: () => opts.report.reportCacheHit(locator),
      onMiss: () => opts.report.reportCacheMiss(locator, `${structUtils.prettyLocator(opts.project.configuration, locator)} can't be found in the cache and will be fetched from the disk`),
      loader: () => this.fetchFromDisk(locator, opts),
      ...opts.cacheOptions,
    });

    return {
      packageFs,
      releaseFs,
      prefixPath: structUtils.getIdentVendorPath(locator),
      checksum,
    };
  }

  async fetchFromDisk(locator: Locator, opts: FetchOptions) {
    const sourceBuffer = await fileUtils.fetchArchiveFromLocator(locator, opts);

    return await tgzUtils.convertToZip(sourceBuffer, {
      configuration: opts.project.configuration,
      prefixPath: structUtils.getIdentVendorPath(locator),
      stripComponents: 1,
    });
  }
}
