import {structUtils, FetchOptions, Locator, miscUtils, tgzUtils, Ident, FetchResult} from '@yarnpkg/core';
import {ppath, PortablePath, npath, CwdFS}                                           from '@yarnpkg/fslib';
import {ZipFS}                                                                       from '@yarnpkg/libzip';

import {PROTOCOL}                                                                    from './constants';

export function parseSpec(spec: string) {
  const {params, selector} = structUtils.parseRange(spec);

  const path = npath.toPortablePath(selector);

  const parentLocator = params && typeof params.locator === `string`
    ? structUtils.parseLocator(params.locator)
    : null;

  return {parentLocator, path};
}

export function makeSpec({parentLocator, path, hash, protocol}: {parentLocator: Locator | null, path: string, hash?: string, protocol: string}) {
  const parentLocatorSpread = parentLocator !== null
    ? {locator: structUtils.stringifyLocator(parentLocator)}
    : {} as {};

  const folderHashSpread = typeof hash !== `undefined`
    ? {hash}
    : {} as {};

  return structUtils.makeRange({
    protocol,
    source: path,
    selector: path,
    params: {
      ...folderHashSpread,
      ...parentLocatorSpread,
    },
  });
}

export function makeLocator(ident: Ident, {parentLocator, path, hash, protocol}: Parameters<typeof makeSpec>[number]): Locator {
  return structUtils.makeLocator(ident, makeSpec({parentLocator, path, hash, protocol}));
}

export async function fetchArchiveFromLocator(locator: Locator, opts: FetchOptions) {
  const {parentLocator, path} = structUtils.parseFileStyleRange(locator.reference, {protocol: PROTOCOL});

  // If the file target is an absolute path we can directly access it via its
  // location on the disk. Otherwise we must go through the package fs.
  const parentFetch: FetchResult = ppath.isAbsolute(path)
    ? {packageFs: new CwdFS(PortablePath.root), prefixPath: PortablePath.dot, localPath: PortablePath.root}
    : await opts.fetcher.fetch(parentLocator, opts);

  // If the package fs publicized its "original location" (for example like
  // in the case of "file:" packages), we use it to derive the real location.
  const effectiveParentFetch: FetchResult = parentFetch.localPath
    ? {packageFs: new CwdFS(PortablePath.root), prefixPath: ppath.relative(PortablePath.root, parentFetch.localPath)}
    : parentFetch;

  // Discard the parent fs unless we really need it to access the files
  if (parentFetch !== effectiveParentFetch && parentFetch.releaseFs)
    parentFetch.releaseFs();

  const sourceFs = effectiveParentFetch.packageFs;
  const sourcePath = ppath.join(effectiveParentFetch.prefixPath, path);

  return await miscUtils.releaseAfterUseAsync(async () => {
    return await sourceFs.readFilePromise(sourcePath);
  }, effectiveParentFetch.releaseFs);
}

export async function makeArchiveFromLocator(locator: Locator, {protocol, fetchOptions, inMemory = false}: {protocol: string, fetchOptions: FetchOptions, inMemory?: boolean}): Promise<ZipFS> {
  const {parentLocator, path} = structUtils.parseFileStyleRange(locator.reference, {protocol});

  // If the file target is an absolute path we can directly access it via its
  // location on the disk. Otherwise we must go through the package fs.
  const parentFetch: FetchResult = ppath.isAbsolute(path)
    ? {packageFs: new CwdFS(PortablePath.root), prefixPath: PortablePath.dot, localPath: PortablePath.root}
    : await fetchOptions.fetcher.fetch(parentLocator, fetchOptions);

  // If the package fs publicized its "original location" (for example like
  // in the case of "file:" packages), we use it to derive the real location.
  const effectiveParentFetch: FetchResult = parentFetch.localPath
    ? {packageFs: new CwdFS(PortablePath.root), prefixPath: ppath.relative(PortablePath.root, parentFetch.localPath)}
    : parentFetch;

  // Discard the parent fs unless we really need it to access the files
  if (parentFetch !== effectiveParentFetch && parentFetch.releaseFs)
    parentFetch.releaseFs();

  const sourceFs = effectiveParentFetch.packageFs;
  const sourcePath = ppath.join(effectiveParentFetch.prefixPath, path);

  return await miscUtils.releaseAfterUseAsync(async () => {
    return await tgzUtils.makeArchiveFromDirectory(sourcePath, {
      baseFs: sourceFs,
      prefixPath: structUtils.getIdentVendorPath(locator),
      compressionLevel: fetchOptions.project.configuration.get(`compressionLevel`),
      inMemory,
    });
  }, effectiveParentFetch.releaseFs);
}

export async function makeBufferFromLocator(locator: Locator, {protocol, fetchOptions}: {protocol: string, fetchOptions: FetchOptions}) {
  const folderFs = await makeArchiveFromLocator(locator, {protocol, fetchOptions, inMemory: true});

  return folderFs.getBufferAndClose();
}
