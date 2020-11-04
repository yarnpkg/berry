import {Fetcher, FetchOptions, MinimalFetchOptions, ReportError, MessageName} from '@yarnpkg/core';
import {Locator}                                                              from '@yarnpkg/core';
import {miscUtils, structUtils}                                               from '@yarnpkg/core';
import {ppath, xfs, ZipFS, Filename, CwdFS, PortablePath}                     from '@yarnpkg/fslib';
import {getLibzipPromise}                                                     from '@yarnpkg/libzip';

import * as patchUtils                                                        from './patchUtils';
import {UnmatchedHunkError}                                                   from './tools/UnmatchedHunkError';
import {reportHunk}                                                           from './tools/format';

export class PatchFetcher implements Fetcher {
  supports(locator: Locator, opts: MinimalFetchOptions) {
    if (!locator.reference.startsWith(`patch:`))
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
      onMiss: () => opts.report.reportCacheMiss(locator, `${structUtils.prettyLocator(opts.project.configuration, locator)} can't be found in the cache and will be fetched from the disk`),
      loader: () => this.patchPackage(locator, opts),
      skipIntegrityCheck: opts.skipIntegrityCheck,
    });

    return {
      packageFs,
      releaseFs,
      prefixPath: structUtils.getIdentVendorPath(locator),
      localPath: this.getLocalPath(locator, opts),
      checksum,
    };
  }

  private async patchPackage(locator: Locator, opts: FetchOptions) {
    const {parentLocator, sourceLocator, sourceVersion, patchPaths} = patchUtils.parseLocator(locator);
    const patchFiles = await patchUtils.loadPatchFiles(parentLocator, patchPaths, opts);

    const tmpDir = await xfs.mktempPromise();
    const tmpFile = ppath.join(tmpDir, `patched.zip` as Filename);

    const sourceFetch = await opts.fetcher.fetch(sourceLocator, opts);
    const prefixPath = structUtils.getIdentVendorPath(locator);

    const libzip = await getLibzipPromise();

    const patchedPackage = new ZipFS(tmpFile, {
      libzip,
      create: true,
      level: opts.project.configuration.get(`compressionLevel`),
    });

    await patchedPackage.mkdirpPromise(prefixPath);

    await miscUtils.releaseAfterUseAsync(async () => {
      await patchedPackage.copyPromise(prefixPath, sourceFetch.prefixPath, {baseFs: sourceFetch.packageFs, stableSort: true});
    }, sourceFetch.releaseFs);

    const patchFs = new CwdFS(ppath.resolve(PortablePath.root, prefixPath), {baseFs: patchedPackage});

    for (const patchFile of patchFiles) {
      if (patchFile !== null) {
        try {
          await patchUtils.applyPatchFile(patchUtils.parsePatchFile(patchFile), {
            baseFs: patchFs,
            version: sourceVersion,
          });
        } catch (err) {
          if (!(err instanceof UnmatchedHunkError))
            throw err;

          const enableInlineHunks = opts.project.configuration.get(`enableInlineHunks`);
          const suggestion = !enableInlineHunks
            ? ` (set enableInlineHunks for details)`
            : ``;

          throw new ReportError(MessageName.PATCH_HUNK_FAILED, err.message + suggestion, report => {
            if (!enableInlineHunks)
              return;

            reportHunk(err.hunk, {
              configuration: opts.project.configuration,
              report,
            });
          });
        }
      }
    }

    return patchedPackage;
  }
}
