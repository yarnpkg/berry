import {Fetcher, FetchOptions, MinimalFetchOptions} from '@berry/core';
import {Locator}                                    from '@berry/core';
import {structUtils}                                from '@berry/core';
import {JailFS, NodeFS}                             from '@berry/zipfs';
import {posix}                                      from 'path';
import querystring                                  from 'querystring';

import {LINK_PROTOCOL}                              from './constants';

export class LinkFetcher implements Fetcher {
  supports(locator: Locator, opts: MinimalFetchOptions) {
    if (!locator.reference.startsWith(LINK_PROTOCOL))
      return false;

    return true;
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    const {parentLocator, linkPath} = this.parseLocator(locator);

    const parentFetch = posix.isAbsolute(linkPath)
      ? {packageFs: new NodeFS(), prefixPath: `/`, localPath: `/`}
      : await opts.fetcher.fetch(parentLocator, opts);

    const effectiveParentFetch = parentFetch.localPath
      ? {packageFs: new NodeFS(), prefixPath: parentFetch.localPath}
      : parentFetch;
    
    const sourceFs = effectiveParentFetch.packageFs;
    const sourcePath = posix.resolve(effectiveParentFetch.prefixPath, linkPath);

    if (parentFetch.localPath) {
      return {packageFs: new JailFS(sourcePath, {baseFs: sourceFs}), prefixPath: `/`, localPath: sourcePath};
    } else {
      return {packageFs: new JailFS(sourcePath, {baseFs: sourceFs}), prefixPath: `/`};
    }
  }

  private parseLocator(locator: Locator) {
    const qsIndex = locator.reference.indexOf(`?`);

    if (qsIndex === -1)
      throw new Error(`Invalid link-type locator`);

    const linkPath = posix.normalize(locator.reference.slice(LINK_PROTOCOL.length, qsIndex));
    const queryString = querystring.parse(locator.reference.slice(qsIndex + 1));

    if (typeof queryString.locator !== `string`)
      throw new Error(`Invalid link-type locator`);

    const parentLocator = structUtils.parseLocator(queryString.locator, true);

    return {parentLocator, linkPath};
  }
}
