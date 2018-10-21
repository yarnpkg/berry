import semver = require('semver');

import {Fetcher, FetchOptions, MinimalFetchOptions} from '@berry/core';
import {httpUtils, tgzUtils}                        from '@berry/core';
import {Locator, Manifest}                          from '@berry/core';

import {DEFAULT_REGISTRY}                           from './constants';

export class NpmFetcher implements Fetcher {
  public mountPoint: string = `cached-fetchers`;

  supports(locator: Locator, opts: MinimalFetchOptions) {
    if (!semver.valid(locator.reference))
      return false;

    return true;
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    const tgz = await httpUtils.get(this.getLocatorUrl(locator, opts));

    return await tgzUtils.makeArchive(tgz, {
      stripComponents: 1,
    });
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
