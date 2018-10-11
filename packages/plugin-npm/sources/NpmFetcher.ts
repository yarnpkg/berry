import semver = require('semver');

import {Fetcher, FetchOptions} from '@berry/core';
import {httpUtils, tgzUtils}   from '@berry/core';
import {Locator, Manifest}     from '@berry/core';

export class NpmFetcher implements Fetcher {
  public mountPoint: string = `cached-fetchers`;

  supports(locator: Locator) {
    if (!semver.valid(locator.reference))
      return false;

    return true;
  }

  async fetchManifest(locator: Locator, opts: FetchOptions): Promise<Manifest> {
    throw new Error(`Unimplemented`);
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    const tgz = await httpUtils.get(this.getLocatorUrl(locator, opts));

    return await tgzUtils.makeArchive(tgz, {
      stripComponents: 1,
    });
  }

  getLocatorUrl(locator: Locator, opts: FetchOptions) {
    if (locator.scope) {
      return `https://registry.npmjs.org/@${locator.scope}/${locator.name}/-/${locator.name}-${locator.reference}.tgz`;
    } else {
      return `https://registry.npmjs.org/${locator.name}/-/${locator.name}-${locator.reference}.tgz`;
    }
  }
}
