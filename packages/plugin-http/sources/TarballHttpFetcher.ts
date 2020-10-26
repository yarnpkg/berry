import {Fetcher, FetchOptions, MinimalFetchOptions}    from '@yarnpkg/core';
import {Locator}                                       from '@yarnpkg/core';
import {httpUtils, scriptUtils, structUtils, tgzUtils} from '@yarnpkg/core';
import {PortablePath, CwdFS, ppath, xfs}               from '@yarnpkg/fslib';
import querystring                                     from 'querystring';

import {TARBALL_REGEXP, PROTOCOL_REGEXP}               from './constants';

export class TarballHttpFetcher implements Fetcher {
  supports(locator: Locator, opts: MinimalFetchOptions) {
    if (!TARBALL_REGEXP.test(locator.reference))
      return false;

    if (PROTOCOL_REGEXP.test(locator.reference))
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
    let source = false;
    let workspace: string | undefined;
    let url = locator.reference;
    const hashIndex = url.indexOf(`#`);
    if (hashIndex !== -1) {
      url = url.slice(0, hashIndex);
      const extra = querystring.parse(url.slice(hashIndex + 1));
      source = !!extra?.source;
      if (source && extra.workspace) {
        workspace = Array.isArray(extra.workspace) ? extra.workspace[0] : extra.workspace;
      }
    }

    let sourceBuffer = await httpUtils.get(url, {
      configuration: opts.project.configuration,
    });

    if (source)
      sourceBuffer = await this.packageWorkspace(sourceBuffer, workspace, opts);

    return await tgzUtils.convertToZip(sourceBuffer, {
      compressionLevel: opts.project.configuration.get(`compressionLevel`),
      prefixPath: structUtils.getIdentVendorPath(locator),
      stripComponents: 1,
    });
  }

  async packageWorkspace(sourceBuffer: Buffer, workspace: string | undefined, opts: FetchOptions) {
    return await xfs.mktempPromise(async extractPath => {
      const extractTarget = new CwdFS(extractPath);

      await tgzUtils.extractArchiveTo(sourceBuffer, extractTarget, {
        stripComponents: 1,
      });

      const packagePath = ppath.join(extractPath, `package.tgz` as PortablePath);

      await scriptUtils.prepareExternalProject(extractPath, packagePath, {
        configuration: opts.project.configuration,
        report: opts.report,
        workspace,
      });

      return await xfs.readFilePromise(packagePath);
    });
  }
}
