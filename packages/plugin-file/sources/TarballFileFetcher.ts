import querystring = require('querystring');

import {Fetcher, FetchOptions, MinimalFetchOptions} from '@berry/core';
import {Locator}                                    from '@berry/core';
import {structUtils, tgzUtils}                      from '@berry/core';
import {posix}                                      from 'path';

import {TARBALL_REGEXP, PROTOCOL}                   from './constants';

export class TarballFileFetcher implements Fetcher {
  public mountPoint: string = `cached-fetchers`;

  supports(locator: Locator, opts: MinimalFetchOptions) {
    if (!TARBALL_REGEXP.test(locator.reference))
      return false;

    if (locator.reference.startsWith(PROTOCOL))
      return true;

    return false;
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    const {parentLocator, filePath} = this.parseLocator(locator);
    const parentFs = await opts.fetcher.fetch(parentLocator, opts);

    return await tgzUtils.makeArchive(parentFs.readFile(filePath), {
      stripComponents: 1,
    });
  }

  private parseLocator(locator: Locator) {
    const qsIndex = locator.reference.indexOf(`?`);

    if (qsIndex === -1)
      throw new Error(`Invalid file-type locator`);

    const filePath = locator.reference.slice(PROTOCOL.length, qsIndex);
    const queryString = querystring.parse(locator.reference.slice(qsIndex + 1));

    if (typeof queryString.locator !== `string`)
      throw new Error(`Invalid file-type locator`);

    const parentLocator = structUtils.parseLocator(queryString.locator);

    return {parentLocator, filePath};
  }
}
