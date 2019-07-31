import {Fetcher, FetchOptions, MinimalFetchOptions}                         from '@berry/core';
import {Locator, MessageName}                                               from '@berry/core';
import {execUtils, miscUtils, scriptUtils, structUtils, tgzUtils}           from '@berry/core';
import {NodeFS, PortablePath, ppath}                                        from '@berry/fslib';

import {GIT_REGEXP}                                                         from './constants';
import * as gitUtils                                                        from './gitUtils';

export class GitFetcher implements Fetcher {
  supports(locator: Locator, opts: MinimalFetchOptions) {
    if (locator.reference.match(GIT_REGEXP))
      return true;

    return false;
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
        opts.report.reportInfoOnce(MessageName.FETCH_NOT_CACHED, `${structUtils.prettyLocator(opts.project.configuration, locator)} can't be found in the cache and will be fetched from the remote repository`);
        return await this.cloneFromRemote(locator, opts);
      },
    );

    return {
      packageFs,
      releaseFs,
      prefixPath: `/sources` as PortablePath,
      checksum,
    };
  }

  async cloneFromRemote(locator: Locator, opts: FetchOptions) {
    const directory = await gitUtils.clone(locator.reference);

    const env = await scriptUtils.makeScriptEnv(opts.project);
    await execUtils.execvp(`yarn`, [`install`], {cwd: directory, env: env});
    await execUtils.execvp(`yarn`, [`pack`], {cwd: directory, env: env});

    const packagePath = ppath.join(directory, `package.tgz` as PortablePath);
    const sourceBuffer = await new NodeFS().readFilePromise(packagePath);

    return await miscUtils.releaseAfterUseAsync(async () => {
      return await tgzUtils.makeArchive(sourceBuffer, {
        stripComponents: 1,
        prefixPath: `/sources` as PortablePath,
      });
    });
  }
}
