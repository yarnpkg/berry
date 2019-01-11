import {Fetcher, FetchOptions, FetchResult, MinimalFetchOptions} from '@berry/core';
import {Locator}                                                 from '@berry/core';
import {structUtils}                                             from '@berry/core';
import {JailFS}                                                  from '@berry/zipfs';
import {posix}                                                   from 'path';
import querystring                                               from 'querystring';

import {LINK_PROTOCOL}                                           from './constants';

export class LinkFetcher implements Fetcher {
  static mountPoint: string = `virtual-fetchers`;

  supports(locator: Locator, opts: MinimalFetchOptions) {
    if (!locator.reference.startsWith(LINK_PROTOCOL))
      return false;

    return true;
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    const {parentLocator, linkPath} = this.parseLocator(locator);

    if (posix.isAbsolute(linkPath))
      return [new JailFS(linkPath), async () => {}] as FetchResult;

    const [baseFs, release] = await opts.fetcher.fetch(parentLocator, opts);
    const packageFs = new JailFS(linkPath, {baseFs});

    return [packageFs, release] as FetchResult;
  }

  private parseLocator(locator: Locator) {
    const qsIndex = locator.reference.indexOf(`?`);

    if (qsIndex === -1)
      throw new Error(`Invalid link-type locator`);

    const linkPath = locator.reference.slice(LINK_PROTOCOL.length, qsIndex);
    const queryString = querystring.parse(locator.reference.slice(qsIndex + 1));

    if (typeof queryString.locator !== `string`)
      throw new Error(`Invalid link-type locator`);

    const parentLocator = structUtils.parseLocator(queryString.locator, true);

    return {parentLocator, linkPath};
  }
}
