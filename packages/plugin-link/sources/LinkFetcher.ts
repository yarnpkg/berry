import querystring = require('querystring');

import {Fetcher, FetchOptions, MinimalFetchOptions} from '@berry/core';
import {Locator}                                    from '@berry/core';
import {structUtils}                                from '@berry/core';
import {JailFS}                                     from '@berry/zipfs';
import {posix}                                      from 'path';

import {LINK_PROTOCOL}                              from './constants';

export class LinkFetcher implements Fetcher {
  public mountPoint: string = `virtual-fetchers`;

  supports(locator: Locator, opts: MinimalFetchOptions) {
    if (!locator.reference.startsWith(LINK_PROTOCOL))
      return false;

    return true;
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    const {parentLocator, linkPath} = this.parseLocator(locator);
    const parentFs = await opts.fetcher.fetch(parentLocator, opts);

    if (posix.isAbsolute(linkPath)) {
      return new JailFS(linkPath);
    } else {
      return new JailFS(posix.resolve(`/`, linkPath), {baseFs: parentFs});
    }
  }

  private parseLocator(locator: Locator) {
    const qsIndex = locator.reference.indexOf(`?`);

    if (qsIndex === -1)
      throw new Error(`Invalid link-type locator`);

    const linkPath = locator.reference.slice(LINK_PROTOCOL.length, qsIndex);
    const queryString = querystring.parse(locator.reference.slice(qsIndex + 1));

    if (typeof queryString.locator !== `string`)
      throw new Error(`Invalid link-type locator`);

    const parentLocator = structUtils.parseLocator(queryString.locator);

    return {parentLocator, linkPath};
  }
}
