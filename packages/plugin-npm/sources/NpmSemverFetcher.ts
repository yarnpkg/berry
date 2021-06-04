import {Configuration, Fetcher, FetchOptions, MinimalFetchOptions} from '@yarnpkg/core';
import {structUtils, tgzUtils}                                     from '@yarnpkg/core';
import {Locator, MessageName, ReportError}                         from '@yarnpkg/core';
import semver                                                      from 'semver';
import {URL}                                                       from 'url';

import {PROTOCOL}                                                  from './constants';
import * as npmConfigUtils                                         from './npmConfigUtils';
import * as npmHttpUtils                                           from './npmHttpUtils';

export class NpmSemverFetcher implements Fetcher {
  supports(locator: Locator, opts: MinimalFetchOptions) {
    if (!locator.reference.startsWith(PROTOCOL))
      return false;

    const url = new URL(locator.reference);

    if (!semver.valid(url.pathname))
      return false;
    if (url.searchParams.has(`__archiveUrl`))
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
      onMiss: () => opts.report.reportCacheMiss(locator, `${structUtils.prettyLocator(opts.project.configuration, locator)} can't be found in the cache and will be fetched from the remote registry`),
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

  private async fetchFromNetwork(locator: Locator, opts: FetchOptions) {
    let sourceBuffer;
    try {
      sourceBuffer = await npmHttpUtils.get(NpmSemverFetcher.getLocatorUrl(locator), {
        configuration: opts.project.configuration,
        ident: locator,
      });
    } catch (error) {
      // The npm registry doesn't always support %2f when fetching the package tarballs 🤡
      // OK: https://registry.yarnpkg.com/@emotion%2fbabel-preset-css-prop/-/babel-preset-css-prop-10.0.7.tgz
      // KO: https://registry.yarnpkg.com/@xtuc%2fieee754/-/ieee754-1.2.0.tgz
      sourceBuffer = await npmHttpUtils.get(NpmSemverFetcher.getLocatorUrl(locator).replace(/%2f/g, `/`), {
        configuration: opts.project.configuration,
        ident: locator,
      });
    }

    return await tgzUtils.convertToZip(sourceBuffer, {
      compressionLevel: opts.project.configuration.get(`compressionLevel`),
      prefixPath: structUtils.getIdentVendorPath(locator),
      stripComponents: 1,
    });
  }

  static isConventionalTarballUrl(locator: Locator, url: string, {configuration}: {configuration: Configuration}) {
    let registry = npmConfigUtils.getScopeRegistry(locator.scope, {configuration});
    const path = NpmSemverFetcher.getLocatorUrl(locator);

    // From time to time the npm registry returns http urls instead of https 🤡
    url = url.replace(/^https?:(\/\/(?:[^/]+\.)?npmjs.org(?:$|\/))/, `https:$1`);

    // The yarnpkg and npmjs registries are interchangeable for that matter, so we uniformize them
    registry = registry.replace(/^https:\/\/registry\.npmjs\.org($|\/)/, `https://registry.yarnpkg.com$1`);
    url = url.replace(/^https:\/\/registry\.npmjs\.org($|\/)/, `https://registry.yarnpkg.com$1`);

    if (url === registry + path)
      return true;
    if (url === registry + path.replace(/%2f/g, `/`))
      return true;

    return false;
  }

  static getLocatorUrl(locator: Locator) {
    const version = semver.clean(locator.reference.slice(PROTOCOL.length));
    if (version === null)
      throw new ReportError(MessageName.RESOLVER_NOT_FOUND, `The npm semver resolver got selected, but the version isn't semver`);

    return `${npmHttpUtils.getIdentUrl(locator)}/-/${locator.name}-${version}.tgz`;
  }
}
