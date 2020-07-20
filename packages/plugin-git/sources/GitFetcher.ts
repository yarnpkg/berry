import {Fetcher, FetchOptions, MinimalFetchOptions, FetchResult} from '@yarnpkg/core';
import {Locator}                                                 from '@yarnpkg/core';
import {miscUtils, scriptUtils, structUtils, tgzUtils}           from '@yarnpkg/core';
import {PortablePath, ppath, xfs}                                from '@yarnpkg/fslib';

import * as gitUtils                                             from './gitUtils';
import {Hooks}                                                   from './index';

export class GitFetcher implements Fetcher {
  supports(locator: Locator, opts: MinimalFetchOptions) {
    return gitUtils.isGitUrl(locator.reference);
  }

  getLocalPath(locator: Locator, opts: FetchOptions) {
    return null;
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    const expectedChecksum = opts.checksums.get(locator.locatorHash) || null;
    const normalizedLocator = gitUtils.normalizeLocator(locator);

    const checksums = new Map(opts.checksums);
    checksums.set(normalizedLocator.locatorHash, expectedChecksum);
    const nextOpts = {...opts, checksums};

    const result = await this.downloadHosted(normalizedLocator, nextOpts);
    if (result !== null)
      return result;

    const [packageFs, releaseFs, checksum] = await opts.cache.fetchPackageFromCache(locator, expectedChecksum, {
      onHit: () => opts.report.reportCacheHit(locator),
      onMiss: () => opts.report.reportCacheMiss(locator, `${structUtils.prettyLocator(opts.project.configuration, locator)} can't be found in the cache and will be fetched from the remote repository`),
      loader: () => this.cloneFromRemote(normalizedLocator, nextOpts),
      skipIntegrityCheck: opts.skipIntegrityCheck,
    });

    return {
      packageFs,
      releaseFs,
      prefixPath: structUtils.getIdentVendorPath(locator),
      checksum,
    };
  }

  async downloadHosted(locator: Locator, opts: FetchOptions) {
    return opts.project.configuration.reduceHook((hooks: Hooks) => {
      return hooks.fetchHostedRepository;
    }, null as FetchResult | null, locator, opts);
  }

  async cloneFromRemote(locator: Locator, opts: FetchOptions) {
    const cloneTarget = await gitUtils.clone(locator.reference, opts.project.configuration);

    const repoUrlParts = gitUtils.splitRepoUrl(locator.reference);
    const packagePath = ppath.join(cloneTarget, `package.tgz` as PortablePath);

    await scriptUtils.prepareExternalProject(cloneTarget, packagePath, {
      configuration: opts.project.configuration,
      report: opts.report,
      workspace: repoUrlParts.extra.workspace,
    });

    const sourceBuffer = await xfs.readFilePromise(packagePath);

    return await miscUtils.releaseAfterUseAsync(async () => {
      return await tgzUtils.convertToZip(sourceBuffer, {
        compressionLevel: opts.project.configuration.get(`compressionLevel`),
        prefixPath: structUtils.getIdentVendorPath(locator),
        stripComponents: 1,
      });
    });
  }
}
