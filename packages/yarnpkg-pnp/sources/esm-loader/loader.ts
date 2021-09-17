import {NativePath, PortablePath}          from '@yarnpkg/fslib';
import fs                                  from 'fs';
import moduleExports                       from 'module';
import path                                from 'path';
import {fileURLToPath, pathToFileURL, URL} from 'url';

import * as nodeUtils                      from '../loader/nodeUtils';
import {PnpApi}                            from '../types';

function tryParseURL(str: string) {
  try {
    return new URL(str);
  } catch {
    return null;
  }
}

const builtins = new Set([...moduleExports.builtinModules]);

const pathRegExp = /^(?![a-zA-Z]:[\\/]|\\\\|\.{0,2}(?:\/|$))((?:node:)?(?:@[^/]+\/)?[^/]+)\/*(.*|)$/;

async function exists(path: string) {
  try {
    await fs.promises.access(path, fs.constants.R_OK);
    return true;
  } catch { }
  return false;
}

export async function resolve(
  originalSpecifier: string,
  context: any,
  defaultResolver: any,
) {
  const {findPnpApi} = (moduleExports as unknown as { findPnpApi?: (path: NativePath) => null | PnpApi });
  if (!findPnpApi || builtins.has(originalSpecifier))
    return defaultResolver(originalSpecifier, context, defaultResolver);

  let specifier = originalSpecifier;
  const url = tryParseURL(specifier);
  if (url) {
    if (url.protocol !== `file:`)
      return defaultResolver(originalSpecifier, context, defaultResolver);

    specifier = fileURLToPath(specifier);
  }

  const {parentURL, conditions = []} = context;

  const issuer = parentURL ? fileURLToPath(parentURL) : process.cwd();

  // Get the pnpapi of either the issuer or the specifier.
  // The latter is required when the specifier is an absolute path to a
  // zip file and the issuer doesn't belong to a pnpapi
  const pnpapi = findPnpApi(issuer) ?? (url ? findPnpApi(specifier) : null);
  if (!pnpapi)
    return defaultResolver(originalSpecifier, context, defaultResolver);

  const dependencyNameMatch = specifier.match(pathRegExp);

  let allowLegacyResolve = false;

  if (dependencyNameMatch) {
    const [, dependencyName, subPath] = dependencyNameMatch as [unknown, string, PortablePath];

    // If the package.json doesn't list an `exports` field, Node will tolerate omitting the extension
    // https://github.com/nodejs/node/blob/0996eb71edbd47d9f9ec6153331255993fd6f0d1/lib/internal/modules/esm/resolve.js#L686-L691
    if (subPath === ``) {
      const resolved = pnpapi.resolveToUnqualified(`${dependencyName}/package.json`, issuer);
      if (resolved && await exists(resolved)) {
        const pkg = JSON.parse(await fs.promises.readFile(resolved, `utf8`));
        allowLegacyResolve = pkg.exports == null;
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

  return {
    url: pathToFileURL(result).href,
  };
}

// The default `getFormat` doesn't support reading from zip files
export async function getFormat(
  resolved: string,
  context: any,
  defaultGetFormat: any,
) {
  const url = tryParseURL(resolved);
  if (url?.protocol !== `file:`)
    return defaultGetFormat(resolved, context, defaultGetFormat);

  const ext = path.extname(url.pathname);
  switch (ext) {
    case `.mjs`: {
      return {
        format: `module`,
      };
    }
    case `.cjs`: {
      return {
        format: `commonjs`,
      };
    }
    case `.json`: {
      // TODO: Enable if --experimental-json-modules is present
      // Waiting on https://github.com/nodejs/node/issues/36935
      throw new Error(
        `Unknown file extension ".json" for ${fileURLToPath(resolved)}`,
      );
    }
    case `.js`: {
      const pkg = nodeUtils.readPackageScope(fileURLToPath(resolved));
      if (pkg) {
        return {
          format: pkg.data.type ?? `commonjs`,
        };
      }
    }
  }

  return defaultGetFormat(resolved, context, defaultGetFormat);
}

// The default `getSource` doesn't support reading from zip files
export async function getSource(
  urlString: string,
  context: any,
  defaultGetSource: any,
) {
  const url = tryParseURL(urlString);
  if (url?.protocol !== `file:`)
    return defaultGetSource(url, context, defaultGetSource);

  return {
    source: await fs.promises.readFile(fileURLToPath(urlString), `utf8`),
  };
}

//#region ESM to CJS support
/*
  In order to import CJS files from ESM Node does some translating
  internally[1]. This translator calls an unpatched `readFileSync`[2]
  which itself calls an internal `tryStatSync`[3] which calls
  `binding.fstat`[4]. A PR[5] has been made to use the monkey-patchable
  `fs.readFileSync` but assuming that wont be merged this region of code
  patches that final `binding.fstat` call.

  1: https://github.com/nodejs/node/blob/d872aaf1cf20d5b6f56a699e2e3a64300e034269/lib/internal/modules/esm/translators.js#L177-L277
  2: https://github.com/nodejs/node/blob/d872aaf1cf20d5b6f56a699e2e3a64300e034269/lib/internal/modules/esm/translators.js#L240
  3: https://github.com/nodejs/node/blob/1317252dfe8824fd9cfee125d2aaa94004db2f3b/lib/fs.js#L452
  4: https://github.com/nodejs/node/blob/1317252dfe8824fd9cfee125d2aaa94004db2f3b/lib/fs.js#L403
  5: https://github.com/nodejs/node/pull/39513
*/

const binding = (process as any).binding(`fs`) as {
  fstat: (fd: number, useBigint: false, req: any, ctx: object) => Float64Array
};
const originalfstat = binding.fstat;

const ZIP_FD = 0x80000000;
binding.fstat = function(...args) {
  const [fd, useBigint, req] = args;
  if ((fd & ZIP_FD) !== 0 && useBigint === false && req === undefined) {
    try {
      const stats = fs.fstatSync(fd);
      // The reverse of this internal util
      // https://github.com/nodejs/node/blob/8886b63cf66c29d453fdc1ece2e489dace97ae9d/lib/internal/fs/utils.js#L542-L551
      return new Float64Array([
        stats.dev,
        stats.mode,
        stats.nlink,
        stats.uid,
        stats.gid,
        stats.rdev,
        stats.blksize,
        stats.ino,
        stats.size,
        stats.blocks,
        // atime sec
        // atime ns
        // mtime sec
        // mtime ns
        // ctime sec
        // ctime ns
        // birthtime sec
        // birthtime ns
      ]);
    } catch {}
  }

  return originalfstat.apply(this, args);
};
//#endregion
