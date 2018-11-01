import semver = require('semver');

import {Fetcher, FetchOptions, MinimalFetchOptions} from '@berry/core';
import {httpUtils, structUtils, tgzUtils}           from '@berry/core';
import {Locator}                                    from '@berry/core';

import {DEFAULT_REGISTRY}                           from './constants';

export class NpmFetcher implements Fetcher {
  public mountPoint: string = `cached-fetchers`;

  supports(locator: Locator, opts: MinimalFetchOptions) {
    if (!semver.valid(locator.reference))
      return false;

    return true;
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    const tgz = await httpUtils.get(this.getLocatorUrl(locator, opts), opts.project.configuration);
    const prefixPath = `node_modules/${structUtils.requirableIdent(locator)}`;

    const archive = await tgzUtils.makeArchive(tgz, {
      stripComponents: 1,
      prefixPath,
    });

    // Since we installed everything into a subdirectory, we need to create this symlink to instruct the cache as to which directory to use
    await archive.symlinkPromise(prefixPath, `berry-pkg`);

    return archive;
  }

  private getLocatorUrl(locator: Locator, opts: FetchOptions) {
    const registry = opts.project.configuration.registryServer || DEFAULT_REGISTRY;

    if (locator.scope) {
      return `${registry}/@${locator.scope}/${locator.name}/-/${locator.name}-${locator.reference}.tgz`;
    } else {
      return `${registry}/${locator.name}/-/${locator.name}-${locator.reference}.tgz`;
    }
  }
}
