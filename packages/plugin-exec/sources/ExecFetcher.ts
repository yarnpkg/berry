import {Fetcher, FetchOptions, MinimalFetchOptions}                                     from '@berry/core';
import {Locator, MessageName}                                                           from '@berry/core';
import {execUtils, scriptUtils, structUtils, tgzUtils}                                  from '@berry/core';
import {NodeFS, xfs, ppath, PortablePath, toFilename}                                   from '@berry/fslib';
import querystring                                                                      from 'querystring';
import {dirSync, tmpNameSync}                                                           from 'tmp';

import {PROTOCOL}                                                                       from './constants';

export class ExecFetcher implements Fetcher {
  supports(locator: Locator, opts: MinimalFetchOptions) {
    if (!locator.reference.startsWith(PROTOCOL))
      return false;

    return true;
  }

  getLocalPath(locator: Locator, opts: FetchOptions) {
    const {parentLocator, execPath} = this.parseLocator(locator);

    if (ppath.isAbsolute(execPath))
      return execPath;

    const parentLocalPath = opts.fetcher.getLocalPath(parentLocator, opts);

    if (parentLocalPath !== null) {
      return ppath.resolve(parentLocalPath, execPath);
    } else {
      return null;
    }
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
      prefixPath: `/sources` as PortablePath,
      localPath: this.getLocalPath(locator, opts),
      checksum,
    };
  }

  private async fetchFromDisk(locator: Locator, opts: FetchOptions) {
    const {parentLocator, execPath} = this.parseLocator(locator);

    // If the file target is an absolute path we can directly access it via its
    // location on the disk. Otherwise we must go through the package fs.
    const parentFetch = ppath.isAbsolute(execPath)
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
    const generatorPath = ppath.resolve(ppath.resolve(generatorFs.getRealPath(), effectiveParentFetch.prefixPath), execPath);

    // Execute the specified script in the temporary directory
    const cwd = await this.generatePackage(locator, generatorPath, opts);

    // Make sure the script generated the package
    if (!xfs.existsSync(ppath.join(cwd, toFilename(`build`))))
      throw new Error(`The script should have generated a build directory`);

    return await tgzUtils.makeArchiveFromDirectory(ppath.join(cwd, toFilename(`build`)), {
      prefixPath: `/sources` as PortablePath,
    });
  }

  private async generatePackage(locator: Locator, generatorPath: PortablePath, opts: FetchOptions) {
    const cwd = NodeFS.toPortablePath(dirSync().name);
    const env = await scriptUtils.makeScriptEnv(opts.project);

    const logFile = NodeFS.toPortablePath(tmpNameSync({
      prefix: `buildfile-`,
      postfix: `.log`,
    }));

    const stdin = null;
    const stdout = xfs.createWriteStream(logFile);
    const stderr = stdout;

    stdout.write(`# This file contains the result of Yarn generating a package (${structUtils.stringifyLocator(locator)})\n`);
    stdout.write(`\n`);

    const {code} = await execUtils.pipevp(process.execPath, [NodeFS.fromPortablePath(generatorPath), structUtils.stringifyIdent(locator)], {cwd, env, stdin, stdout, stderr});
    if (code !== 0)
      throw new Error(`Package generation failed (exit code ${code}, logs can be found here: ${logFile})`);

    return cwd;
  }

  private parseLocator(locator: Locator) {
    const qsIndex = locator.reference.indexOf(`?`);

    if (qsIndex === -1)
      throw new Error(`Invalid file-type locator`);

    const execPath = ppath.normalize(locator.reference.slice(PROTOCOL.length, qsIndex) as PortablePath);
    const queryString = querystring.parse(locator.reference.slice(qsIndex + 1));

    if (typeof queryString.locator !== `string`)
      throw new Error(`Invalid file-type locator`);

    const parentLocator = structUtils.parseLocator(queryString.locator, true);

    return {parentLocator, execPath};
  }
}
