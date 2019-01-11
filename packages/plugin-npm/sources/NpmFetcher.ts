import {Fetcher, FetchOptions, FetchResult, MinimalFetchOptions} from '@berry/core';
import {httpUtils, structUtils, tgzUtils}                        from '@berry/core';
import {Locator}                                                 from '@berry/core';
import semver                                                    from 'semver';

import {DEFAULT_REGISTRY, PROTOCOL}                              from './constants';

export class NpmFetcher implements Fetcher {
  static mountPoint: string = `cached-fetchers`;

  supports(locator: Locator, opts: MinimalFetchOptions) {
    if (!locator.reference.startsWith(PROTOCOL))
      return false;

    if (!semver.valid(locator.reference.slice(PROTOCOL.length)))
      return false;

    return true;
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    const tgz = await httpUtils.get(this.getLocatorUrl(locator, opts), opts.project.configuration);
    const prefixPath = `node_modules/${structUtils.requirableIdent(locator)}`;

    const packageFs = await tgzUtils.makeArchive(tgz, {
      stripComponents: 1,
      prefixPath,
    });

    // Since we installed everything into a subdirectory, we need to create this symlink to instruct the cache as to which directory to use
    await packageFs.symlinkPromise(prefixPath, `berry-pkg`);

    return [packageFs, async () => packageFs.close()] as FetchResult;
  }

  private getLocatorUrl(locator: Locator, opts: FetchOptions) {
    const version = locator.reference.slice(PROTOCOL.length);
    const registry = opts.project.configuration.registryServer || DEFAULT_REGISTRY;

    return `${registry}/${structUtils.requirableIdent(locator)}/-/${locator.name}-${version}.tgz`;
  }
}
