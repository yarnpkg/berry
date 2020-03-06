import {Fetcher, FetchOptions, MinimalFetchOptions}                    from '@yarnpkg/core';
import {Locator, MessageName}                                          from '@yarnpkg/core';
import {execUtils, scriptUtils, structUtils, tgzUtils}                 from '@yarnpkg/core';
import {Filename, NodeFS, PortablePath, npath, ppath, toFilename, xfs} from '@yarnpkg/fslib';

import {PROTOCOL}                                                      from './constants';

export class ExecFetcher implements Fetcher {
  supports(locator: Locator, opts: MinimalFetchOptions) {
    if (!locator.reference.startsWith(PROTOCOL))
      return false;

    return true;
  }

  getLocalPath(locator: Locator, opts: FetchOptions) {
    const {parentLocator, path} = structUtils.parseFileStyleRange(locator.reference, {protocol: PROTOCOL});
    if (ppath.isAbsolute(path))
      return path;

    const parentLocalPath = opts.fetcher.getLocalPath(parentLocator, opts);
    if (parentLocalPath === null)
      return null;

    return ppath.resolve(parentLocalPath, path);
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    const expectedChecksum = opts.checksums.get(locator.locatorHash) || null;

    const [packageFs, releaseFs, checksum] = await opts.cache.fetchPackageFromCache(
      locator,
      expectedChecksum,
      async () => {
        opts.report.reportInfoOnce(MessageName.FETCH_NOT_CACHED, `${structUtils.prettyLocator(opts.project.configuration, locator)} can't be found in the cache and will be fetched from the disk`);
        return await this.fetchFromDisk(locator, opts);
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

  private async fetchFromDisk(locator: Locator, opts: FetchOptions) {
    const {parentLocator, path} = structUtils.parseFileStyleRange(locator.reference, {protocol: PROTOCOL});

    // If the file target is an absolute path we can directly access it via its
    // location on the disk. Otherwise we must go through the package fs.
    const parentFetch = ppath.isAbsolute(path)
      ? {packageFs: new NodeFS(), prefixPath: PortablePath.root, localPath: PortablePath.root}
      : await opts.fetcher.fetch(parentLocator, opts);

    // If the package fs publicized its "original location" (for example like
    // in the case of "file:" packages), we use it to derive the real location.
    const effectiveParentFetch = parentFetch.localPath
      ? {packageFs: new NodeFS(), prefixPath: parentFetch.localPath}
      : parentFetch;

    // Discard the parent fs unless we really need it to access the files
    if (parentFetch !== effectiveParentFetch && parentFetch.releaseFs)
      parentFetch.releaseFs();

    const generatorFs = effectiveParentFetch.packageFs;
    const generatorPath = ppath.resolve(ppath.resolve(generatorFs.getRealPath(), effectiveParentFetch.prefixPath), path);

    return xfs.mktempPromise(async cwd => {
      // Execute the specified script in the temporary directory
      await this.generatePackage(cwd, locator, generatorPath, opts);

      // Make sure the script generated the package
      if (!xfs.existsSync(ppath.join(cwd, toFilename(`build`))))
        throw new Error(`The script should have generated a build directory`);

      return await tgzUtils.makeArchiveFromDirectory(ppath.join(cwd, toFilename(`build`)), {
        prefixPath: structUtils.getIdentVendorPath(locator),
      });
    });
  }

  private async generatePackage(cwd: PortablePath, locator: Locator, generatorPath: PortablePath, opts: FetchOptions) {
    return await xfs.mktempPromise(async binFolder => {
      const env = await scriptUtils.makeScriptEnv({project: opts.project, binFolder});

      return await xfs.mktempPromise(async logDir => {
        const logFile = ppath.join(logDir, `buildfile.log` as Filename);

        const stdin = null;
        const stdout = xfs.createWriteStream(logFile);
        const stderr = stdout;

        stdout.write(`# This file contains the result of Yarn generating a package (${structUtils.stringifyLocator(locator)})\n`);
        stdout.write(`\n`);

        const {code} = await execUtils.pipevp(process.execPath, [npath.fromPortablePath(generatorPath), structUtils.stringifyIdent(locator)], {cwd, env, stdin, stdout, stderr});
        if (code !== 0) {
          xfs.detachTemp(logDir);
          throw new Error(`Package generation failed (exit code ${code}, logs can be found here: ${logFile})`);
        }
      });
    });
  }
}
