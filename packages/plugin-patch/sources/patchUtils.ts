import {Cache, structUtils, Locator, Descriptor, Ident, Project, ThrowReport, miscUtils, FetchOptions, Package, execUtils} from '@yarnpkg/core';

import {npath, PortablePath, xfs, ppath, Filename, NativePath, CwdFS}                                                      from '@yarnpkg/fslib';

import {Hooks as PatchHooks}                                                                                               from './index';

export {applyPatchFile} from './tools/apply';
export {parsePatchFile} from './tools/parse';

const BUILTIN_REGEXP = /^builtin<([^>]+)>$/;

function parseSpec<T>(spec: string, sourceParser: (source: string) => T) {
  const {source, selector, params} = structUtils.parseRange(spec);
  if (source === null)
    throw new Error(`Patch locators must explicitly define their source`);

  const patchPaths = selector
    ? selector.split(/&/).map(path => npath.toPortablePath(path))
    : [];

  const parentLocator = params && typeof params.locator === `string`
    ? structUtils.parseLocator(params.locator)
    : null;

  const sourceVersion = params && typeof params.version === `string`
    ? params.version
    : null;

  const sourceItem = sourceParser(source);

  return {parentLocator, sourceItem, patchPaths, sourceVersion};
}

export function parseDescriptor(descriptor: Descriptor) {
  const {sourceItem, ...rest} = parseSpec(descriptor.range, structUtils.parseDescriptor);
  return {...rest, sourceDescriptor: sourceItem};
}

export function parseLocator(locator: Locator) {
  const {sourceItem, ...rest} = parseSpec(locator.reference, structUtils.parseLocator);
  return {...rest, sourceLocator: sourceItem};
}

function makeSpec<T>({parentLocator, sourceItem, patchPaths, sourceVersion, patchHash}: {parentLocator: Locator | null, sourceItem: T, patchPaths: Array<PortablePath>, sourceVersion?: string | null, patchHash?: string}, sourceStringifier: (source: T) => string) {
  const parentLocatorSpread = parentLocator !== null
    ? {locator: structUtils.stringifyLocator(parentLocator)}
    : {} as {};

  const sourceVersionSpread = typeof sourceVersion !== `undefined`
    ? {version: sourceVersion}
    : {} as {};

  const patchHashSpread = typeof patchHash !== `undefined`
    ? {hash: patchHash}
    : {} as {};

  return structUtils.makeRange({
    protocol: `patch:`,
    source: sourceStringifier(sourceItem),
    selector: patchPaths.join(`&`),
    params: {
      ...sourceVersionSpread,
      ...patchHashSpread,
      ...parentLocatorSpread,
    },
  });
}

export function makeDescriptor(ident: Ident, {parentLocator, sourceDescriptor, patchPaths}: ReturnType<typeof parseDescriptor>) {
  return structUtils.makeLocator(ident, makeSpec({parentLocator, sourceItem: sourceDescriptor, patchPaths}, structUtils.stringifyDescriptor));
}

export function makeLocator(ident: Ident, {parentLocator, sourcePackage, patchPaths, patchHash}: Omit<ReturnType<typeof parseLocator>, 'sourceLocator' | 'sourceVersion'> & {sourcePackage: Package, patchHash: string}) {
  return structUtils.makeLocator(ident, makeSpec({parentLocator, sourceItem: sourcePackage, sourceVersion: sourcePackage.version, patchPaths, patchHash}, structUtils.stringifyLocator));
}

type VisitPatchPathOptions<T> = {
  onAbsolute: (p: PortablePath) => T,
  onRelative: (p: PortablePath) => T,
  onBuiltin: (name: string) => T,
};

function visitPatchPath<T>({onAbsolute, onRelative, onBuiltin}: VisitPatchPathOptions<T>, patchPath: PortablePath) {
  const builtinMatch = patchPath.match(BUILTIN_REGEXP);
  if (builtinMatch !== null)
    return onBuiltin(builtinMatch[1]);

  if (ppath.isAbsolute(patchPath)) {
    return onAbsolute(patchPath);
  } else {
    return onRelative(patchPath);
  }
}

export function isParentRequired(patchPath: PortablePath) {
  return visitPatchPath({
    onAbsolute: () => false,
    onRelative: () => true,
    onBuiltin: () => false,
  }, patchPath);
}

export async function loadPatchFiles(parentLocator: Locator | null, patchPaths: Array<PortablePath>, opts: FetchOptions) {
  // When the patch files use absolute paths we can directly access them via
  // their location on the disk. Otherwise we must go through the package fs.
  const parentFetch = parentLocator !== null
    ? await opts.fetcher.fetch(parentLocator, opts)
    : null;

  // If the package fs publicized its "original location" (for example like
  // in the case of "file:" packages), we use it to derive the real location.
  const effectiveParentFetch = parentFetch && parentFetch.localPath
    ? {packageFs: new CwdFS(PortablePath.root), prefixPath: ppath.relative(PortablePath.root, parentFetch.localPath)}
    : parentFetch;

  // Discard the parent fs unless we really need it to access the files
  if (parentFetch && parentFetch !== effectiveParentFetch && parentFetch.releaseFs)
    parentFetch.releaseFs();

  // First we obtain the specification for all the patches that we'll have to
  // apply to the original package.
  const patchFiles = await miscUtils.releaseAfterUseAsync(async () => {
    return await Promise.all(patchPaths.map(async patchPath => visitPatchPath({
      onAbsolute: async () => {
        return await xfs.readFilePromise(patchPath, `utf8`);
      },

      onRelative: async () => {
        if (parentFetch === null)
          throw new Error(`Assertion failed: The parent locator should have been fetched`);

        return await parentFetch.packageFs.readFilePromise(patchPath, `utf8`);
      },

      onBuiltin: async name => {
        return await opts.project.configuration.firstHook((hooks: PatchHooks) => {
          return hooks.getBuiltinPatch;
        }, opts.project, name);
      },
    }, patchPath)));
  });

  // Normalizes the line endings to prevent mismatches when cloning a
  // repository on Windows systems (the default settings for Git are to
  // convert newlines back and forth, which would mess with the checksum)
  return patchFiles.map(definition => {
    if (typeof definition === `string`) {
      return definition.replace(/\r\n?/g, `\n`);
    } else {
      return definition;
    }
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

  xfs.detachTemp(temp);
  return temp;
}

export async function diffFolders(folderA: PortablePath, folderB: PortablePath) {
  const folderAN = npath.fromPortablePath(folderA).replace(/\\/g, `/`);
  const folderBN = npath.fromPortablePath(folderB).replace(/\\/g, `/`);

  const {stdout} = await execUtils.execvp(`git`, [`diff`, `--src-prefix=a/`, `--dst-prefix=b/`, `--ignore-cr-at-eol`, `--full-index`, `--no-index`, folderAN, folderBN], {
    cwd: npath.toPortablePath(process.cwd()),
  });

  const normalizePath = folderAN.startsWith(`/`)
    ? (p: NativePath) => p.slice(1)
    : (p: NativePath) => p;

  return stdout
    .replace(new RegExp(`(a|b)(${miscUtils.escapeRegExp(`/${normalizePath(folderAN)}/`)})`, `g`), `$1/`)
    .replace(new RegExp(`(a|b)${miscUtils.escapeRegExp(`/${normalizePath(folderBN)}/`)}`, `g`), `$1/`)
    .replace(new RegExp(miscUtils.escapeRegExp(`${folderAN}/`), `g`), ``)
    .replace(new RegExp(miscUtils.escapeRegExp(`${folderBN}/`), `g`), ``);
}
