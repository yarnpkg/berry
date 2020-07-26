import {structUtils, FetchOptions, Locator, miscUtils, tgzUtils, Ident} from '@yarnpkg/core';
import {ppath, PortablePath, npath, CwdFS, ZipFS, xfs}                  from '@yarnpkg/fslib';

export function parseSpec(spec: string) {
  const {params, selector} = structUtils.parseRange(spec);

  const path = npath.toPortablePath(selector);

  const parentLocator = params && typeof params.locator === `string`
    ? structUtils.parseLocator(params.locator)
    : null;

  return {parentLocator, path};
}

export function makeSpec({parentLocator, path, folderHash, protocol}: {parentLocator: Locator | null, path: string, folderHash?: string, protocol: string}) {
  const parentLocatorSpread = parentLocator !== null
    ? {locator: structUtils.stringifyLocator(parentLocator)}
    : {} as {};

  const folderHashSpread = typeof folderHash !== `undefined`
    ? {hash: folderHash}
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

export function makeLocator(ident: Ident, {parentLocator, path, folderHash, protocol}: Parameters<typeof makeSpec>[number]): Locator {
  return structUtils.makeLocator(ident, makeSpec({parentLocator, path, folderHash, protocol}));
}

export async function loadFolderFs(locator: Locator, protocol: string, opts: FetchOptions): Promise<ZipFS> {
  const {parentLocator, path} = structUtils.parseFileStyleRange(locator.reference, {protocol});

  // If the file target is an absolute path we can directly access it via its
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

  return await miscUtils.releaseAfterUseAsync(async () => {
    return await tgzUtils.makeArchiveFromDirectory(sourcePath, {
      baseFs: sourceFs,
      prefixPath: structUtils.getIdentVendorPath(locator),
      compressionLevel: opts.project.configuration.get(`compressionLevel`),
    });
  }, effectiveParentFetch.releaseFs);
}

export async function loadFolderContents(locator: Locator, protocol: string, opts: FetchOptions) {
  const folderFs = await loadFolderFs(locator, protocol, opts);

  folderFs.saveAndClose();

  return await xfs.readFilePromise(folderFs.getRealPath());
}
