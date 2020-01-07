import {Fetcher, FetchOptions, MinimalFetchOptions} from '@yarnpkg/core';
import {Locator, MessageName}                       from '@yarnpkg/core';
import {miscUtils, structUtils}                     from '@yarnpkg/core';
import {ppath, xfs, ZipFS, Filename, CwdFS}         from '@yarnpkg/fslib';

import * as patchUtils                              from './patchUtils';

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

    const [packageFs, releaseFs, checksum] = await opts.cache.fetchPackageFromCache(
      locator,
      expectedChecksum,
      async () => {
        opts.report.reportInfoOnce(MessageName.FETCH_NOT_CACHED, `${structUtils.prettyLocator(opts.project.configuration, locator)} can't be found in the cache and will be fetched from the disk`);
        return await this.patchPackage(locator, opts);
      },
    );

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

    const copiedPackage = new ZipFS(tmpFile, {create: true});
    await copiedPackage.mkdirpPromise(prefixPath);

    await miscUtils.releaseAfterUseAsync(async () => {
      await copiedPackage.copyPromise(prefixPath, sourceFetch.prefixPath, {baseFs: sourceFetch.packageFs});
    }, sourceFetch.releaseFs);

    copiedPackage.saveAndClose();

    const patchedPackage = new ZipFS(tmpFile);
    const patchFs = new CwdFS(prefixPath, {baseFs: patchedPackage});

    for (const patchFile of patchFiles) {
      if (patchFile !== null) {
        await patchUtils.applyPatchFile(patchUtils.parsePatchFile(patchFile), {
          baseFs: patchFs,
          version: sourceVersion,
        });
      }
    }

    return patchedPackage;
  }
}
