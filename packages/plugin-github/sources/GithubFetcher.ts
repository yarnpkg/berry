import {Fetcher, FetchOptions, MinimalFetchOptions}    from '@yarnpkg/core';
import {Locator, MessageName}                          from '@yarnpkg/core';
import {httpUtils, scriptUtils, structUtils, tgzUtils} from '@yarnpkg/core';
import {PortablePath, CwdFS, npath, ppath, xfs}        from '@yarnpkg/fslib';
import {tmpNameSync}                                   from 'tmp';

import * as githubUtils                                from './githubUtils';

export class GithubFetcher implements Fetcher {
  supports(locator: Locator, opts: MinimalFetchOptions) {
    if (!githubUtils.isGithubUrl(locator.reference))
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
        opts.report.reportInfoOnce(MessageName.FETCH_NOT_CACHED, `${structUtils.prettyLocator(opts.project.configuration, locator)} can't be found in the cache and will be fetched from the remote repository`);
        return await this.fetchFromNetwork(locator, opts);
      },
    );

    return {
      packageFs,
      releaseFs,
      prefixPath: structUtils.getIdentVendorPath(locator),
      checksum,
    };
  }

  async fetchFromNetwork(locator: Locator, opts: FetchOptions) {
    const sourceBuffer = await httpUtils.get(this.getLocatorUrl(locator, opts), {
      configuration: opts.project.configuration,
    });

    const extractPath = npath.toPortablePath(tmpNameSync());
    const extractTarget = new CwdFS(extractPath);

    await tgzUtils.extractArchiveTo(sourceBuffer, extractTarget, {
      stripComponents: 1,
    });

    const packagePath = ppath.join(extractPath, `package.tgz` as PortablePath);
    await scriptUtils.prepareExternalProject(extractPath, packagePath, {
      configuration: opts.project.configuration,
      report: opts.report,
    });

    const packedBuffer = await xfs.readFilePromise(packagePath);

    return await tgzUtils.convertToZip(packedBuffer, {
      stripComponents: 1,
      prefixPath: structUtils.getIdentVendorPath(locator),
    });
  }

  private getLocatorUrl(locator: Locator, opts: MinimalFetchOptions) {
    const {auth, username, reponame, treeish} = githubUtils.parseGithubUrl(locator.reference);

    return `https://${auth ? `${auth}@` : ``}github.com/${username}/${reponame}/archive/${treeish}.tar.gz`;
  }
}
