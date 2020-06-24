import {Fetcher, FetchOptions, MinimalFetchOptions} from '@yarnpkg/core';
import {Locator}                                    from '@yarnpkg/core';
import {miscUtils, structUtils, tgzUtils}           from '@yarnpkg/core';
import {PortablePath, ppath, CwdFS}                 from '@yarnpkg/fslib';

import {TARBALL_REGEXP, PROTOCOL}                   from './constants';

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
      skipIntegrityCheck: opts.skipIntegrityCheck,
    });

    return {
      packageFs,
      releaseFs,
      prefixPath: structUtils.getIdentVendorPath(locator),
      checksum,
    };
  }

  async fetchFromDisk(locator: Locator, opts: FetchOptions) {
    const {parentLocator, path} = structUtils.parseFileStyleRange(locator.reference, {protocol: PROTOCOL});

    // If the file target is an absolute path we can directly access it via its
    // location on the disk. Otherwise we must go through the package fs.
    const parentFetch = ppath.isAbsolute(path)
      ? {packageFs: new CwdFS(PortablePath.root), prefixPath: PortablePath.dot, localPath: PortablePath.root}
      : await opts.fetcher.fetch(parentLocator, opts);

    // If the package fs publicized its "original location" (for example like
    // in the case of "file:" packages), we use it to derive the real location.
    const effectiveParentFetch = parentFetch.localPath
      ? {packageFs: new CwdFS(PortablePath.root), prefixPath: ppath.relative(PortablePath.root, parentFetch.localPath)}
      : parentFetch;

    // Discard the parent fs unless we really need it to access the files
    if (parentFetch !== effectiveParentFetch && parentFetch.releaseFs)
      parentFetch.releaseFs();

    const sourceFs = effectiveParentFetch.packageFs;
    const sourcePath = ppath.join(effectiveParentFetch.prefixPath, path);
    const sourceBuffer = await sourceFs.readFilePromise(sourcePath);

    return await miscUtils.releaseAfterUseAsync(async () => {
      return await tgzUtils.convertToZip(sourceBuffer, {
        compressionLevel: opts.project.configuration.get(`compressionLevel`),
        prefixPath: structUtils.getIdentVendorPath(locator),
        stripComponents: 1,
      });
    }, effectiveParentFetch.releaseFs);
  }
}
