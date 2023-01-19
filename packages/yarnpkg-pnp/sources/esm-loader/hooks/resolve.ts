import {NativePath, PortablePath}     from '@yarnpkg/fslib';
import fs                             from 'fs';
import moduleExports                  from 'module';
import {fileURLToPath, pathToFileURL} from 'url';

import * as nodeUtils                 from '../../loader/nodeUtils';
import {packageImportsResolve}        from '../../node/resolve';
import {PnpApi}                       from '../../types';
import * as loaderUtils               from '../loaderUtils';

const pathRegExp = /^(?![a-zA-Z]:[\\/]|\\\\|\.{0,2}(?:\/|$))((?:node:)?(?:@[^/]+\/)?[^/]+)\/*(.*|)$/;
const isRelativeRegexp = /^\.{0,2}\//;

type ResolveContext = {
  conditions: Array<string>;
  parentURL: string | undefined;
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

async function resolvePrivateRequest(specifier: string, issuer: string, context: ResolveContext, nextResolve: typeof resolve): Promise<{ url: string, shortCircuit: boolean }> {
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

    return resolve(resolved, context, nextResolve);
  }
}

export async function resolve(
  originalSpecifier: string,
  context: ResolveContext,
  nextResolve: typeof resolve,
): Promise<{ url: string, shortCircuit: boolean }> {
  const {findPnpApi} = (moduleExports as unknown) as { findPnpApi?: (path: NativePath) => null | PnpApi };
  if (!findPnpApi || nodeUtils.isBuiltinModule(originalSpecifier))
    return nextResolve(originalSpecifier, context, nextResolve);

  let specifier = originalSpecifier;
  const url = loaderUtils.tryParseURL(specifier, isRelativeRegexp.test(specifier) ? context.parentURL : undefined);
  if (url) {
    if (url.protocol !== `file:`)
      return nextResolve(originalSpecifier, context, nextResolve);

    specifier = fileURLToPath(url);
  }

  const {parentURL, conditions = []} = context;

  const issuer = parentURL ? fileURLToPath(parentURL) : process.cwd();

  // Get the pnpapi of either the issuer or the specifier.
  // The latter is required when the specifier is an absolute path to a
  // zip file and the issuer doesn't belong to a pnpapi
  const pnpapi = findPnpApi(issuer) ?? (url ? findPnpApi(specifier) : null);
  if (!pnpapi)
    return nextResolve(originalSpecifier, context, nextResolve);

  if (specifier.startsWith(`#`))
    return resolvePrivateRequest(specifier, issuer, context, nextResolve);

  const dependencyNameMatch = specifier.match(pathRegExp);

  let allowLegacyResolve = false;

  if (dependencyNameMatch) {
    const [, dependencyName, subPath] = dependencyNameMatch as [unknown, string, PortablePath];

    // If the package.json doesn't list an `exports` field, Node will tolerate omitting the extension
    // https://github.com/nodejs/node/blob/0996eb71edbd47d9f9ec6153331255993fd6f0d1/lib/internal/modules/esm/resolve.js#L686-L691
    if (subPath === `` && dependencyName !== `pnpapi`) {
      const resolved = pnpapi.resolveToUnqualified(`${dependencyName}/package.json`, issuer);
      if (resolved) {
        const content = await loaderUtils.tryReadFile(resolved);
        if (content) {
          const pkg = JSON.parse(content);
          allowLegacyResolve = pkg.exports == null;
        }
      }
    }
  }

  const result = pnpapi.resolveRequest(specifier, issuer, {
    conditions: new Set(conditions),
    // TODO: Handle --experimental-specifier-resolution=node
    extensions: allowLegacyResolve ? undefined : [],
  });

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
