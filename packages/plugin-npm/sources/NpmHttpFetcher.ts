import {Fetcher, FetchOptions, MinimalFetchOptions} from '@yarnpkg/core';
import {Locator, MessageName}                       from '@yarnpkg/core';
import {httpUtils, structUtils, tgzUtils}           from '@yarnpkg/core';
import semver                                       from 'semver';
import {URL}                                        from 'url';

import * as npmHttpUtils                            from './npmHttpUtils';
import {PROTOCOL}                                   from './constants';

export class NpmHttpFetcher implements Fetcher {
  supports(locator: Locator, opts: MinimalFetchOptions) {
    if (!locator.reference.startsWith(PROTOCOL))
      return false;

    const url = new URL(locator.reference);

    if (!semver.valid(url.pathname))
      return false;
    if (!url.searchParams.has(`__archiveUrl`))
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
      prefixPath: structUtils.getIdentVendorPath(locator),
      checksum,
    };
  }

  async fetchFromNetwork(locator: Locator, opts: FetchOptions) {
    const archiveUrl = new URL(locator.reference).searchParams.get(`__archiveUrl`);
    if (archiveUrl === null)
      throw new Error(`Assertion failed: The archiveUrl querystring parameter should have been available`);

    //const sourceBuffer = await httpUtils.get(archiveUrl, {
    //  configuration: opts.project.configuration,
    //});
    let sourceBuffer;
    try {
      sourceBuffer = await npmHttpUtils.get(archiveUrl, {
        configuration: opts.project.configuration,
        ident: locator,
      });
    } catch (error) {
      // The npm registry doesn't always support %2f when fetching the package tarballs 🤡
      // OK: https://registry.yarnpkg.com/@emotion%2fbabel-preset-css-prop/-/babel-preset-css-prop-10.0.7.tgz
      // KO: https://registry.yarnpkg.com/@xtuc%2fieee754/-/ieee754-1.2.0.tgz
      sourceBuffer = await npmHttpUtils.get(archiveUrl.replace(/%2f/g, `/`), {
        configuration: opts.project.configuration,
        ident: locator,
      });
    }
    
    const 
    return await tgzUtils.convertToZip(sourceBuffer, {
      stripComponents: 1,
      prefixPath: structUtils.getIdentVendorPath(locator),
    });
  }
}
