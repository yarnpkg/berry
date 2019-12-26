import {Cache, structUtils, Locator, Descriptor, Ident, Project, ThrowReport, miscUtils, FetchOptions} from '@yarnpkg/core';
import {npath, PortablePath, xfs, ppath, Filename, NodeFS}                                             from '@yarnpkg/fslib';

export {applyPatchFile}                          from './tools/apply';
export {parsePatchFile}                          from './tools/parse';

function parseSpec<T>(spec: string, sourceParser: (source: string) => T) {
  const {source, selector, params} = structUtils.parseRange(spec);
  if (source === null)
    throw new Error(`Patch locators must explicitly define their source`);

  if (!params || typeof params.locator !== `string`)
    throw new Error(`Patch locators must be bound to a source package`);

  const parentLocator = structUtils.parseLocator(params.locator);
  const sourceItem = sourceParser(source);

  const patchPaths = selector
    ? selector.split(/&/).map(path => npath.toPortablePath(path))
    : [];

  return {parentLocator, sourceItem, patchPaths};
}

export function parseDescriptor(descriptor: Descriptor) {
  const {sourceItem, ...rest} = parseSpec(descriptor.range, structUtils.parseDescriptor);
  return {...rest, sourceDescriptor: sourceItem};
}

export function parseLocator(locator: Locator) {
  const {sourceItem, ...rest} = parseSpec(locator.reference, structUtils.parseLocator);
  return {...rest, sourceLocator: sourceItem};
}

function makeSpec<T>({parentLocator, sourceItem, patchPaths, patchHash}: {parentLocator: Locator, sourceItem: T, patchPaths: Array<PortablePath>, patchHash?: string}, sourceStringifier: (source: T) => string) {
  return structUtils.makeRange({
    protocol: `patch:`,
    source: sourceStringifier(sourceItem),
    selector: patchPaths.join(`&`),
    params: {
      locator: structUtils.stringifyLocator(parentLocator),
      ...typeof patchHash !== `undefined` ? {hash: patchHash} : {},
    },
  });
}

export function makeDescriptor(ident: Ident, {parentLocator, sourceDescriptor, patchPaths}: ReturnType<typeof parseDescriptor>) {
  return structUtils.makeLocator(ident, makeSpec({parentLocator, sourceItem: sourceDescriptor, patchPaths}, structUtils.stringifyDescriptor));
}

export function makeLocator(ident: Ident, {parentLocator, sourceLocator, patchPaths, patchHash}: ReturnType<typeof parseLocator> & {patchHash: string}) {
  return structUtils.makeLocator(ident, makeSpec({parentLocator, sourceItem: sourceLocator, patchPaths, patchHash}, structUtils.stringifyLocator));
}

export async function loadPatchFiles(parentLocator: Locator, patchPaths: Array<PortablePath>, opts: FetchOptions) {
  // When the patch files use absolute paths we can directly access them via
  // their location on the disk. Otherwise we must go through the package fs.
  const parentFetch = patchPaths.some(filePath => !ppath.isAbsolute(filePath))
    ? await opts.fetcher.fetch(parentLocator, opts)
    : null;

  // If the package fs publicized its "original location" (for example like
  // in the case of "file:" packages), we use it to derive the real location.
  const effectiveParentFetch = parentFetch && parentFetch.localPath
    ? {packageFs: new NodeFS(), prefixPath: parentFetch.localPath, releaseFs: undefined}
    : parentFetch;

  // Discard the parent fs unless we really need it to access the files
  if (parentFetch && parentFetch !== effectiveParentFetch && parentFetch.releaseFs)
    parentFetch.releaseFs();

  // First we obtain the specification for all the patches that we'll have to
  // apply to the original package.
  return await miscUtils.releaseAfterUseAsync(async () => {
    return await Promise.all(patchPaths.map(async filePath => {
      if (ppath.isAbsolute(filePath)) {
        return xfs.readFilePromise(filePath, `utf8`);
      } else {
        return parentFetch!.packageFs.readFilePromise(filePath, `utf8`);
      }
    }));
  });
}

export async function extractPackageToDisk(locator: Locator, {cache, project}: {cache: Cache, project: Project}) {
  const checksums = project.storedChecksums;
  const report = new ThrowReport();

  const fetcher = project.configuration.makeFetcher();
  const fetchResult = await fetcher.fetch(locator, {cache, project, fetcher, checksums, report});

  const temp = await xfs.mktempPromise();
  await xfs.copyPromise(temp, fetchResult.prefixPath, {
    baseFs: fetchResult.packageFs,
  });

  await xfs.writeJsonPromise(ppath.join(temp, `.yarn-patch.json` as Filename), {
    locator: structUtils.stringifyLocator(locator),
  });

  return temp;
}
