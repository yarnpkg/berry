import semver = require('semver');

import {Archive, Fetcher}                 from '@berry/core';
import {httpUtils, structUtils, tgzUtils} from '@berry/core';
import {Locator}                          from '@berry/core';

export class NpmFetcher implements Fetcher {
  supports(locator: Locator): boolean {
    if (!semver.valid(locator.reference))
      return false;

    return true;
  }

  async fetch(locator: Locator): Promise<Archive> {
    const tgz = await httpUtils.get(this.getLocatorUrl(locator));

    return await tgzUtils.makeArchive(tgz, {
      stripComponents: 1,
    });
  }

  getLocatorUrl(locator: Locator) {
    if (locator.scope) {
      return `https://registry.npmjs.org/@${locator.scope}/${locator.name}/-/${locator.name}-${locator.reference}.tgz`;
    } else {
      return `https://registry.npmjs.org/${locator.name}/-/${locator.name}-${locator.reference}.tgz`;
    }
  }
}
