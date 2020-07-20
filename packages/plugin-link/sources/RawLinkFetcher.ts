import {Fetcher, FetchOptions, MinimalFetchOptions} from '@yarnpkg/core';
import {Locator}                                    from '@yarnpkg/core';
import {structUtils}                                from '@yarnpkg/core';
import {CwdFS, JailFS, ppath, PortablePath}         from '@yarnpkg/fslib';

import {RAW_LINK_PROTOCOL}                          from './constants';

export class RawLinkFetcher implements Fetcher {
  supports(locator: Locator, opts: MinimalFetchOptions) {
    if (!locator.reference.startsWith(RAW_LINK_PROTOCOL))
      return false;

    return true;
  }

  getLocalPath(locator: Locator, opts: FetchOptions) {
    const {parentLocator, path} = structUtils.parseFileStyleRange(locator.reference, {protocol: RAW_LINK_PROTOCOL});
    if (ppath.isAbsolute(path))
      return path;

    const parentLocalPath = opts.fetcher.getLocalPath(parentLocator, opts);
    if (parentLocalPath === null)
      return null;

    return ppath.resolve(parentLocalPath, path);
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    const {parentLocator, path} = structUtils.parseFileStyleRange(locator.reference, {protocol: RAW_LINK_PROTOCOL});

    // If the link target is an absolute path we can directly access it via its
    // location on the disk. Otherwise we must go through the package fs.
    const parentFetch = ppath.isAbsolute(path)
      ? {packageFs: new CwdFS(PortablePath.root), prefixPath: PortablePath.dot, localPath: PortablePath.root}
      : await opts.fetcher.fetch(parentLocator, opts);

    // If the package fs publicized its "original location" (for example like
    // in the case of "file:" packages), we use it to derive the real location.
    const effectiveParentFetch = parentFetch.localPath
      ? {packageFs: new CwdFS(PortablePath.root), prefixPath: ppath.relative(PortablePath.root, parentFetch.localPath)}
      : parentFetch;

    // Discard the parent fs unless we really need it to access the files
    if (parentFetch !== effectiveParentFetch && parentFetch.releaseFs)
      parentFetch.releaseFs();

    const sourceFs = effectiveParentFetch.packageFs;
    const sourcePath = ppath.join(effectiveParentFetch.prefixPath, path);

    if (parentFetch.localPath) {
      return {packageFs: new CwdFS(sourcePath, {baseFs: sourceFs}), releaseFs: effectiveParentFetch.releaseFs, prefixPath: PortablePath.dot, discardFromLookup: true, localPath: sourcePath};
    } else {
      return {packageFs: new JailFS(sourcePath, {baseFs: sourceFs}), releaseFs: effectiveParentFetch.releaseFs, prefixPath: PortablePath.dot, discardFromLookup: true};
    }
  }
}
