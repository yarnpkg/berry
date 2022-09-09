import {Fetcher, FetchOptions, MinimalFetchOptions} from '@yarnpkg/core';
import {Locator}                                    from '@yarnpkg/core';
import {httpUtils, structUtils, tgzUtils}           from '@yarnpkg/core';
import {scriptUtils}                                from '@yarnpkg/core';
import {PortablePath, CwdFS, ppath, xfs}            from '@yarnpkg/fslib';

import {TARBALL_REGEXP, PROTOCOL_REGEXP}            from './constants';

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
      ...opts.cacheOptions,
    });

    return {
      packageFs,
      releaseFs,
      prefixPath: structUtils.getIdentVendorPath(locator),
      checksum,
    };
  }

  private async fetchFromNetwork(locator: Locator, opts: FetchOptions) {
    const url = locator.reference;
    const {
      selector,
    } = structUtils.parseRange(url, {
      parseSelector: true,
      requireProtocol: true,
      requireSource: true,
    });
    const source = !!selector?.source;

    let sourceBuffer = await httpUtils.get(url, {
      configuration: opts.project.configuration,
    });

    if (source) {
      const workspace = selector.workspace ? Array.isArray(selector.workspace) ? selector.workspace[0] : selector.workspace : undefined;
      sourceBuffer = await this.packageWorkspace(sourceBuffer, workspace, locator, opts);
    }

    return await tgzUtils.convertToZip(sourceBuffer, {
      compressionLevel: opts.project.configuration.get(`compressionLevel`),
      prefixPath: structUtils.getIdentVendorPath(locator),
      stripComponents: 1,
    });
  }

  private async packageWorkspace(sourceBuffer: Buffer, workspace: string | undefined, locator: Locator, opts: FetchOptions) {
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
        locator,
      });

      return await xfs.readFilePromise(packagePath);
    });
  }
}
