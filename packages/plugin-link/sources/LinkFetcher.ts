import {Fetcher, FetchOptions, MinimalFetchOptions} from '@berry/core';
import {Locator}                                    from '@berry/core';
import {structUtils}                                from '@berry/core';
import {JailFS, NodeFS}                             from '@berry/fslib';
import {posix}                                      from 'path';
import querystring                                  from 'querystring';

import {LINK_PROTOCOL}                              from './constants';

export class LinkFetcher implements Fetcher {
  supports(locator: Locator, opts: MinimalFetchOptions) {
    if (!locator.reference.startsWith(LINK_PROTOCOL))
      return false;

    return true;
  }

  getLocalPath(locator: Locator, opts: FetchOptions) {
    const {parentLocator, linkPath} = this.parseLocator(locator);

    if (posix.isAbsolute(linkPath))
      return linkPath;
    
    const parentLocalPath = opts.fetcher.getLocalPath(parentLocator, opts);

    if (parentLocalPath !== null) {
      return posix.resolve(parentLocalPath, linkPath);
    } else {
      return null;
    }
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    const {parentLocator, linkPath} = this.parseLocator(locator);

    // If the link target is an absolute path we can directly access it via its
    // location on the disk. Otherwise we must go through the package fs.
    const parentFetch = posix.isAbsolute(linkPath)
      ? {packageFs: new NodeFS(), prefixPath: `/`, localPath: `/`}
      : await opts.fetcher.fetch(parentLocator, opts);

    // If the package fs publicized its "original location" (for example like
    // in the case of "file:" packages), we use it to derive the real location.
    const effectiveParentFetch = parentFetch.localPath
      ? {packageFs: new NodeFS(), prefixPath: parentFetch.localPath}
      : parentFetch;
    
    // Discard the parent fs unless we really need it to access the files
    if (parentFetch !== effectiveParentFetch && parentFetch.releaseFs)
      parentFetch.releaseFs();

    const sourceFs = effectiveParentFetch.packageFs;
    const sourcePath = posix.resolve(effectiveParentFetch.prefixPath, linkPath);

    if (parentFetch.localPath) {
      return {packageFs: new JailFS(sourcePath, {baseFs: sourceFs}), releaseFs: effectiveParentFetch.releaseFs, prefixPath: `/`, localPath: sourcePath};
    } else {
      return {packageFs: new JailFS(sourcePath, {baseFs: sourceFs}), releaseFs: effectiveParentFetch.releaseFs, prefixPath: `/`};
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
