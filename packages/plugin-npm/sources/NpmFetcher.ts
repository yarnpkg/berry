import {Fetcher, FetchOptions, MinimalFetchOptions} from '@berry/core';
import {structUtils, tgzUtils}                      from '@berry/core';
import {Locator, MessageName, ReportError}          from '@berry/core';
import {PortablePath}                               from '@berry/fslib';
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
    let sourceBuffer;
    try {
      sourceBuffer = await npmHttpUtils.get(this.getLocatorUrl(locator, opts), {
        configuration: opts.project.configuration,
        ident: locator,
      });
    } catch (error) {
      // The npm registry doesn't always support %2f when fetching the package tarballs 🤡
      // Ex: https://registry.yarnpkg.com/@emotion%2fbabel-preset-css-prop/-/babel-preset-css-prop-10.0.7.tgz
      sourceBuffer = await npmHttpUtils.get(this.getLocatorUrl(locator, opts).replace(/%2f/g, `/`), {
        configuration: opts.project.configuration,
        ident: locator,
      });
    }

    return await tgzUtils.makeArchive(sourceBuffer, {
      stripComponents: 1,
      prefixPath: this.getPrefixPath(locator),
    });
  }

  private getLocatorUrl(locator: Locator, opts: FetchOptions) {
    const version = semver.clean(locator.reference.slice(PROTOCOL.length));
    if (version === null)
      throw new ReportError(MessageName.RESOLVER_NOT_FOUND, `The npm semver resolver got selected, but the version isn't semver`);

    return `${npmHttpUtils.getIdentUrl(locator)}/-/${locator.name}-${version}.tgz`;
  }

  private getPrefixPath(locator: Locator) {
    return `/node_modules/${structUtils.requirableIdent(locator)}` as PortablePath;
  }
}
