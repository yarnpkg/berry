import {Fetcher, FetchOptions, MinimalFetchOptions} from '@yarnpkg/core';
import {Locator}                                    from '@yarnpkg/core';
import {structUtils}                                from '@yarnpkg/core';
import {JailFS, NodeFS, ppath, PortablePath}        from '@yarnpkg/fslib';
import querystring                                  from 'querystring';

import {RAW_LINK_PROTOCOL}                          from './constants';

export class RawLinkFetcher implements Fetcher {
  supports(locator: Locator, opts: MinimalFetchOptions) {
    if (!locator.reference.startsWith(RAW_LINK_PROTOCOL))
      return false;

    return true;
  }

  getLocalPath(locator: Locator, opts: FetchOptions) {
    const {parentLocator, linkPath} = this.parseLocator(locator);

    if (ppath.isAbsolute(linkPath))
      return linkPath;

    const parentLocalPath = opts.fetcher.getLocalPath(parentLocator, opts);

    if (parentLocalPath !== null) {
      return ppath.resolve(parentLocalPath, linkPath);
    } else {
      return null;
    }
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    const {parentLocator, linkPath} = this.parseLocator(locator);

    // If the link target is an absolute path we can directly access it via its
    // location on the disk. Otherwise we must go through the package fs.
    const parentFetch = ppath.isAbsolute(linkPath)
      ? {packageFs: new NodeFS(), prefixPath: PortablePath.root, localPath: PortablePath.root}
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
    const sourcePath = ppath.resolve(effectiveParentFetch.prefixPath, linkPath);

    if (parentFetch.localPath) {
      return {packageFs: new JailFS(sourcePath, {baseFs: sourceFs}), releaseFs: effectiveParentFetch.releaseFs, prefixPath: PortablePath.root, localPath: sourcePath};
    } else {
      return {packageFs: new JailFS(sourcePath, {baseFs: sourceFs}), releaseFs: effectiveParentFetch.releaseFs, prefixPath: PortablePath.root};
    }
  }

  private parseLocator(locator: Locator) {
    const qsIndex = locator.reference.indexOf(`?`);

    if (qsIndex === -1)
      throw new Error(`Invalid link-type locator`);

    const linkPath = locator.reference.slice(RAW_LINK_PROTOCOL.length, qsIndex) as PortablePath;
    const queryString = querystring.parse(locator.reference.slice(qsIndex + 1));

    if (typeof queryString.locator !== `string`)
      throw new Error(`Invalid link-type locator`);

    const parentLocator = structUtils.parseLocator(queryString.locator, true);

    return {parentLocator, linkPath};
  }
}
