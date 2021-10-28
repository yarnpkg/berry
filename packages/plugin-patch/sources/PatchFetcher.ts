import {Fetcher, FetchOptions, MinimalFetchOptions, ReportError, MessageName, Report} from '@yarnpkg/core';
import {Locator}                                                                      from '@yarnpkg/core';
import {miscUtils, structUtils}                                                       from '@yarnpkg/core';
import {ppath, xfs, ZipFS, Filename, CwdFS, PortablePath}                             from '@yarnpkg/fslib';
import {getLibzipPromise}                                                             from '@yarnpkg/libzip';

import * as patchUtils                                                                from './patchUtils';
import {UnmatchedHunkError}                                                           from './tools/UnmatchedHunkError';
import {reportHunk}                                                                   from './tools/format';

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
      ...opts.cacheOptions,
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
    const currentFile = ppath.join(tmpDir, `current.zip` as Filename);

    const sourceFetch = await opts.fetcher.fetch(sourceLocator, opts);
    const prefixPath = structUtils.getIdentVendorPath(locator);

    const libzip = await getLibzipPromise();

    // First we create a copy of the package that we'll be free to mutate
    const initialCopy = new ZipFS(currentFile, {
      libzip,
      create: true,
      level: opts.project.configuration.get(`compressionLevel`),
    });

    await miscUtils.releaseAfterUseAsync(async () => {
      await initialCopy.copyPromise(prefixPath, sourceFetch.prefixPath, {baseFs: sourceFetch.packageFs, stableSort: true});
    }, sourceFetch.releaseFs);

    initialCopy.saveAndClose();

    for (const {source, optional} of patchFiles) {
      if (source === null)
        continue;

      // Then for each patchfile, we open this copy anew, and try to apply the
      // changeset. We need to open it for each patchfile (rather than only a
      // single time) because it lets us easily rollback when hitting errors
      // on optional patches (we just need to call `discardAndClose`).
      const patchedPackage = new ZipFS(currentFile, {
        libzip,
        level: opts.project.configuration.get(`compressionLevel`),
      });

      const patchFs = new CwdFS(ppath.resolve(PortablePath.root, prefixPath), {
        baseFs: patchedPackage,
      });

      try {
        await patchUtils.applyPatchFile(patchUtils.parsePatchFile(source), {
          baseFs: patchFs,
          version: sourceVersion,
        });
      } catch (err) {
        if (!(err instanceof UnmatchedHunkError))
          throw err;

        const enableInlineHunks = opts.project.configuration.get(`enableInlineHunks`);
        const suggestion = !enableInlineHunks && !optional
          ? ` (set enableInlineHunks for details)`
          : ``;

        const message = `${structUtils.prettyLocator(opts.project.configuration, locator)}: ${err.message}${suggestion}`;
        const reportExtra = (report: Report) => {
          if (!enableInlineHunks)
            return;

          reportHunk(err.hunk, {
            configuration: opts.project.configuration,
            report,
          });
        };

        // By discarding the current changes, the next patch will start from
        // where we were.
        patchedPackage.discardAndClose();

        if (optional) {
          opts.report.reportWarningOnce(MessageName.PATCH_HUNK_FAILED, message, {reportExtra});
          continue;
        } else {
          throw new ReportError(MessageName.PATCH_HUNK_FAILED, message, reportExtra);
        }
      }

      patchedPackage.saveAndClose();
    }

    return new ZipFS(currentFile, {
      libzip,
      level: opts.project.configuration.get(`compressionLevel`),
    });
  }
}
