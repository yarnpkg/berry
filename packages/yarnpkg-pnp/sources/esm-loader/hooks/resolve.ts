import {PortablePath}                        from '@yarnpkg/fslib';
import fs                                    from 'fs';
import esmModule, {createRequire, isBuiltin} from 'module';
import {fileURLToPath, pathToFileURL}        from 'url';

import {packageImportsResolve}               from '../../node/resolve';
import * as loaderUtils                      from '../loaderUtils';

let findPnpApi: any = (esmModule as any).findPnpApi;
if (!findPnpApi) {
  // @ts-expect-error - reason TBS
  const require = createRequire(import.meta.url);

  // We call structuredClone to prevent TS from digging into the PnP file
  const pnpApi = require(structuredClone(`./.pnp.cjs`));
  pnpApi.setup();

  findPnpApi = (esmModule as any).findPnpApi;
}

const pathRegExp = /^(?![a-zA-Z]:[\\/]|\\\\|\.{0,2}(?:\/|$))((?:node:)?(?:@[^/]+\/)?[^/]+)\/*(.*|)$/;
const isRelativeRegexp = /^\.{0,2}\//;

type ResolveContext = {
  conditions: Array<string>;
  parentURL: string | undefined;
};

type ResolveResult = {
  url: string;
  shortCircuit: boolean;
};

// Returned when the resolution must be delegated to the next hook
type ResolveDelegation = {
  delegate: string;
};

function tryReadFile(filePath: string) {
  try {
    return fs.readFileSync(filePath, `utf8`);
  } catch (err) {
    if (err.code === `ENOENT`)
      return undefined;

    throw err;
  }
}

function resolvePrivateRequest(specifier: string, issuer: string, context: ResolveContext): ResolveResult | ResolveDelegation {
  const resolved = packageImportsResolve({
    name: specifier,
    base: pathToFileURL(issuer),
    conditions: new Set(context.conditions),
    readFileSyncFn: tryReadFile,
  });

  if (resolved instanceof URL) {
    return {url: resolved.href, shortCircuit: true};
  } else {
    if (resolved.startsWith(`#`))
      // Node behaves interestingly by default so just block the request for now.
      // https://github.com/nodejs/node/issues/40579
      throw new Error(`Mapping from one private import to another isn't allowed`);

    return resolveRequest(resolved, context);
  }
}

function resolveRequest(originalSpecifier: string, context: ResolveContext): ResolveResult | ResolveDelegation {
  if (!findPnpApi || isBuiltin(originalSpecifier))
    return {delegate: originalSpecifier};

  let specifier = originalSpecifier;
  const url = loaderUtils.tryParseURL(specifier, isRelativeRegexp.test(specifier) ? context.parentURL : undefined);
  if (url) {
    if (url.protocol !== `file:`)
      return {delegate: originalSpecifier};

    specifier = fileURLToPath(url);
  }

  const {parentURL, conditions = []} = context;

  const issuer = parentURL && loaderUtils.tryParseURL(parentURL)?.protocol === `file:` ? fileURLToPath(parentURL) : process.cwd();

  // Get the pnpapi of either the issuer or the specifier.
  // The latter is required when the specifier is an absolute path to a
  // zip file and the issuer doesn't belong to a pnpapi
  const pnpapi = findPnpApi(issuer) ?? (url ? findPnpApi(specifier) : null);
  if (!pnpapi)
    return {delegate: originalSpecifier};

  if (specifier.startsWith(`#`))
    return resolvePrivateRequest(specifier, issuer, context);

  const dependencyNameMatch = specifier.match(pathRegExp);

  let allowLegacyResolve = false;

  if (dependencyNameMatch) {
    const [, dependencyName, subPath] = dependencyNameMatch as [unknown, string, PortablePath];

    // If the package.json doesn't list an `exports` field, Node will tolerate omitting the extension
    // https://github.com/nodejs/node/blob/0996eb71edbd47d9f9ec6153331255993fd6f0d1/lib/internal/modules/esm/resolve.js#L686-L691
    if (subPath === `` && dependencyName !== `pnpapi`) {
      const resolved = pnpapi.resolveToUnqualified(`${dependencyName}/package.json`, issuer);
      if (resolved) {
        const content = tryReadFile(resolved);
        if (content) {
          const pkg = JSON.parse(content);
          allowLegacyResolve = pkg.exports == null;
        }
      }
    }
  }

  let result;
  try {
    result = pnpapi.resolveRequest(specifier, issuer, {
      conditions: new Set(conditions),
      // TODO: Handle --experimental-specifier-resolution=node
      extensions: allowLegacyResolve ? undefined : [],
    });
  } catch (err) {
    if (err instanceof Error && `code` in err && err.code === `MODULE_NOT_FOUND`)
      err.code = `ERR_MODULE_NOT_FOUND`;

    throw err;
  }

  if (!result)
    throw new Error(`Resolving '${specifier}' from '${issuer}' failed`);

  const resultURL = pathToFileURL(result);

  // Node preserves the `search` and `hash` to allow cache busting
  // https://github.com/nodejs/node/blob/85d4cd307957bd35e7c723d0f1d2b77175fd9b0f/lib/internal/modules/esm/resolve.js#L405-L406
  if (url) {
    resultURL.search = url.search;
    resultURL.hash = url.hash;
  }

  if (!parentURL)
    loaderUtils.setEntrypointPath(fileURLToPath(resultURL));

  return {
    url: resultURL.href,
    shortCircuit: true,
  };
}

/**
 * Hook for the off-thread loaders (`--experimental-loader`).
 */
export async function resolve(
  originalSpecifier: string,
  context: ResolveContext,
  nextResolve: typeof resolve,
): Promise<ResolveResult> {
  const result = resolveRequest(originalSpecifier, context);

  return `delegate` in result
    ? nextResolve(result.delegate, context, nextResolve)
    : result;
}

/**
 * Hook for the in-thread loaders (`module.registerHooks`).
 */
export function resolveSync(
  originalSpecifier: string,
  context: ResolveContext,
  nextResolve: typeof resolveSync,
): ResolveResult {
  // Unlike the off-thread hooks, those ones also see the `require` calls,
  // which are already handled by the patches the PnP runtime applies to the
  // CommonJS loader.
  if (!context.conditions?.includes(`import`))
    return nextResolve(originalSpecifier, context, nextResolve);

  const result = resolveRequest(originalSpecifier, context);

  return `delegate` in result
    ? nextResolve(result.delegate, context, nextResolve)
    : result;
}
