import {Fetcher, FetchOptions, MinimalFetchOptions} from '@yarnpkg/core';
import {Locator}                                    from '@yarnpkg/core';
import {structUtils, tgzUtils}                      from '@yarnpkg/core';
import semver                                       from 'semver';

import {PROTOCOL}                                   from './constants';
import * as npmHttpUtils                            from './npmHttpUtils';

export class NpmHttpFetcher implements Fetcher {
  supports(locator: Locator, opts: MinimalFetchOptions) {
    if (!locator.reference.startsWith(PROTOCOL))
      return false;

    const {selector, params} = structUtils.parseRange(locator.reference);
    if (!semver.valid(selector))
      return false;

    if (params === null || typeof params.__archiveUrl !== `string`)
      return false;

    return true;
  }

  getLocalPath(locator: Locator, opts: FetchOptions) {
    return null;
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    const expectedChecksum = opts.checksums.get(locator.locatorHash) || null;

    const [packageFs, releaseFs, checksum] = await opts.cache.fetchPackageFromCache(locator, expectedChecksum, {
      onHit: () => opts.report.reportCacheHit(locator),
      onMiss: () => opts.report.reportCacheMiss(locator, `${structUtils.prettyLocator(opts.project.configuration, locator)} can't be found in the cache and will be fetched from the remote server`),
      loader: () => this.fetchFromNetwork(locator, opts),
      skipIntegrityCheck: opts.skipIntegrityCheck,
    });

    return {
      packageFs,
      releaseFs,
      prefixPath: structUtils.getIdentVendorPath(locator),
      checksum,
    };
  }

  async fetchFromNetwork(locator: Locator, opts: FetchOptions) {
    const {params} = structUtils.parseRange(locator.reference);
    if (params === null || typeof params.__archiveUrl !== `string`)
      throw new Error(`Assertion failed: The archiveUrl querystring parameter should have been available`);

    const sourceBuffer = await npmHttpUtils.get(params.__archiveUrl, {
      configuration: opts.project.configuration,
      ident: locator,
    });

    return await tgzUtils.convertToZip(sourceBuffer, {
      compressionLevel: opts.project.configuration.get(`compressionLevel`),
      prefixPath: structUtils.getIdentVendorPath(locator),
      stripComponents: 1,
    });
  }
}
