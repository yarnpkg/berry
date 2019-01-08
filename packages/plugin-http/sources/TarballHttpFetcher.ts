import {Fetcher, FetchOptions, FetchResult, MinimalFetchOptions} from '@berry/core';
import {httpUtils, tgzUtils}                                     from '@berry/core';
import {Locator, Manifest}                                       from '@berry/core';

import {TARBALL_REGEXP, PROTOCOL_REGEXP}                         from './constants';

export class TarballHttpFetcher implements Fetcher {
  static mountPoint: string = `cached-fetchers`;

  supports(locator: Locator, opts: MinimalFetchOptions) {
    if (!TARBALL_REGEXP.test(locator.reference))
      return false;

    if (PROTOCOL_REGEXP.test(locator.reference))
      return true;

    return false;
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    const tgz = await httpUtils.get(locator.reference, opts.project.configuration);

    const packageFs = await tgzUtils.makeArchive(tgz, {
      stripComponents: 1,
      prefixPath: `berry-pkg`,
    });

    return [packageFs, async () => packageFs.close()] as FetchResult;
  }
}
