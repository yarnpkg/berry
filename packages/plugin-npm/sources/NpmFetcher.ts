import {Fetcher, FetchOptions, MinimalFetchOptions} from '@berry/core';
import {structUtils, tgzUtils}                      from '@berry/core';
import {Locator, MessageName}                       from '@berry/core';
import semver                                       from 'semver';

import {PROTOCOL}                                   from './constants';
import * as npmHttpUtils                            from './npmHttpUtils';

export class NpmFetcher implements Fetcher {
  supports(locator: Locator, opts: MinimalFetchOptions) {
    if (!locator.reference.startsWith(PROTOCOL))
      return false;

    if (!semver.valid(locator.reference.slice(PROTOCOL.length)))
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
        opts.report.reportInfoOnce(MessageName.FETCH_NOT_CACHED, `${structUtils.prettyLocator(opts.project.configuration, locator)} can't be found in the cache and will be fetched from the remote registry`);
        return await this.fetchFromNetwork(locator, opts);
      },
    );

    return {
      packageFs,
      releaseFs,
      prefixPath: this.getPrefixPath(locator),
      checksum,
    };
  }

  private async fetchFromNetwork(locator: Locator, opts: FetchOptions) {
    const sourceBuffer = await npmHttpUtils.get(
      this.getLocatorUrl(locator, opts),
      locator,
      opts.project.configuration,
    );

    return await tgzUtils.makeArchive(sourceBuffer, {
      stripComponents: 1,
      prefixPath: this.getPrefixPath(locator),
    });
  }

  private getLocatorUrl(locator: Locator, opts: FetchOptions) {
    const version = locator.reference.slice(PROTOCOL.length);
    const registry = opts.project.configuration.get(`npmRegistryServer`);

    return `${registry}/${structUtils.requirableIdent(locator)}/-/${locator.name}-${version}.tgz`;
  }

  private getPrefixPath(locator: Locator) {
    return `/node_modules/${structUtils.requirableIdent(locator)}`;
  }
}
