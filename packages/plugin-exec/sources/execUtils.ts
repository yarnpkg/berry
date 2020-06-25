import {structUtils, FetchOptions, Ident, Locator} from '@yarnpkg/core';
import {ppath, PortablePath, npath, CwdFS}         from '@yarnpkg/fslib';


export function parseSpec(spec: string) {
  const {params, selector} = structUtils.parseRange(spec);

  const path = npath.toPortablePath(selector);

  const parentLocator = params && typeof params.locator === `string`
    ? structUtils.parseLocator(params.locator)
    : null;

  return {parentLocator, path};
}

export function makeSpec({parentLocator, path, generatorHash, protocol}: {parentLocator: Locator | null, path: string, generatorHash?: string, protocol: string}) {
  const parentLocatorSpread = parentLocator !== null
    ? {locator: structUtils.stringifyLocator(parentLocator)}
    : {} as {};

  const generatorHashSpread = typeof generatorHash !== `undefined`
    ? {hash: generatorHash}
    : {} as {};

  return structUtils.makeRange({
    protocol,
    source: path,
    selector: path,
    params: {
      ...generatorHashSpread,
      ...parentLocatorSpread,
    },
  });
}

export function makeLocator(ident: Ident, {parentLocator, path, generatorHash, protocol}: Parameters<typeof makeSpec>[number]): Locator {
  return structUtils.makeLocator(ident, makeSpec({parentLocator, path, generatorHash, protocol}));
}

export async function loadGeneratorFile(range: string, protocol: string, opts: FetchOptions): Promise<string> {
  const {parentLocator, path} = structUtils.parseFileStyleRange(range, {protocol});

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

  const generatorFs = effectiveParentFetch.packageFs;
  const generatorPath = ppath.join(effectiveParentFetch.prefixPath, path);

  return await generatorFs.readFilePromise(generatorPath, `utf8`);
}

