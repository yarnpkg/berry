/**
  @license
  Copyright Node.js contributors. All rights reserved.

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to
  deal in the Software without restriction, including without limitation the
  rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
  sell copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in
  all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
  IN THE SOFTWARE.
*/

import { fileURLToPath, pathToFileURL } from 'url';
import {
  ERR_INVALID_MODULE_SPECIFIER,
  ERR_INVALID_PACKAGE_CONFIG,
  ERR_INVALID_PACKAGE_TARGET,
  ERR_PACKAGE_IMPORT_NOT_DEFINED,
  ERR_PACKAGE_PATH_NOT_EXPORTED,
} from './errors.js';
import { getPackageScopeConfig } from './package_config.js';
import {
  JSONStringify,
  StringPrototypeStartsWith,
  RegExpPrototypeSymbolReplace,
  RegExpPrototypeExec,
  StringPrototypeSlice,
  StringPrototypeReplace,
  ArrayIsArray,
  ObjectGetOwnPropertyNames,
  StringPrototypeIndexOf,
  StringPrototypeEndsWith,
  ObjectPrototypeHasOwnProperty,
  StringPrototypeIncludes,
  StringPrototypeLastIndexOf,
} from './primordials.js';

function throwImportNotDefined(specifier, packageJSONUrl, base) {
  throw new ERR_PACKAGE_IMPORT_NOT_DEFINED(
    specifier,
    packageJSONUrl && fileURLToPath(new URL('.', packageJSONUrl)),
    fileURLToPath(base)
  );
}

function throwInvalidSubpath(subpath, packageJSONUrl, internal, base) {
  const reason = `request is not a valid subpath for the "${
    internal ? 'imports' : 'exports'
  }" resolution of ${fileURLToPath(packageJSONUrl)}`;
  throw new ERR_INVALID_MODULE_SPECIFIER(
    subpath,
    reason,
    base && fileURLToPath(base)
  );
}

function throwInvalidPackageTarget(
  subpath,
  target,
  packageJSONUrl,
  internal,
  base
) {
  if (typeof target === 'object' && target !== null) {
    target = JSONStringify(target, null, '');
  } else {
    target = `${target}`;
  }
  throw new ERR_INVALID_PACKAGE_TARGET(
    fileURLToPath(new URL('.', packageJSONUrl)),
    subpath,
    target,
    internal,
    base && fileURLToPath(base)
  );
}

const invalidSegmentRegEx =
  /(^|\\|\/)((\.|%2e)(\.|%2e)?|(n|%6e|%4e)(o|%6f|%4f)(d|%64|%44)(e|%65|%45)(_|%5f)(m|%6d|%4d)(o|%6f|%4f)(d|%64|%44)(u|%75|%55)(l|%6c|%4c)(e|%65|%45)(s|%73|%53))(\\|\/|$)/i;
const patternRegEx = /\*/g;

function resolvePackageTargetString(
  target,
  subpath,
  match,
  packageJSONUrl,
  base,
  pattern,
  internal,
  conditions
) {
  if (subpath !== '' && !pattern && target[target.length - 1] !== '/')
    throwInvalidPackageTarget(match, target, packageJSONUrl, internal, base);

  if (!StringPrototypeStartsWith(target, './')) {
    if (
      internal &&
      !StringPrototypeStartsWith(target, '../') &&
      !StringPrototypeStartsWith(target, '/')
    ) {
      let isURL = false;
      try {
        new URL(target);
        isURL = true;
      } catch {
        // Continue regardless of error.
      }
      if (!isURL) {
        const exportTarget = pattern
          ? RegExpPrototypeSymbolReplace(patternRegEx, target, () => subpath)
          : target + subpath;
        return exportTarget;
      }
    }
    throwInvalidPackageTarget(match, target, packageJSONUrl, internal, base);
  }

  if (
    RegExpPrototypeExec(
      invalidSegmentRegEx,
      StringPrototypeSlice(target, 2)
    ) !== null
  )
    throwInvalidPackageTarget(match, target, packageJSONUrl, internal, base);

  const resolved = new URL(target, packageJSONUrl);
  const resolvedPath = resolved.pathname;
  const packagePath = new URL('.', packageJSONUrl).pathname;

  if (!StringPrototypeStartsWith(resolvedPath, packagePath))
    throwInvalidPackageTarget(match, target, packageJSONUrl, internal, base);

  if (subpath === '') return resolved;

  if (RegExpPrototypeExec(invalidSegmentRegEx, subpath) !== null) {
    const request = pattern
      ? StringPrototypeReplace(match, '*', () => subpath)
      : match + subpath;
    throwInvalidSubpath(request, packageJSONUrl, internal, base);
  }

  if (pattern) {
    return new URL(
      RegExpPrototypeSymbolReplace(patternRegEx, resolved.href, () => subpath)
    );
  }

  return new URL(subpath, resolved);
}

function isArrayIndex(key) {
  const keyNum = +key;
  if (`${keyNum}` !== key) return false;
  return keyNum >= 0 && keyNum < 0xffff_ffff;
}

function resolvePackageTarget(
  packageJSONUrl,
  target,
  subpath,
  packageSubpath,
  base,
  pattern,
  internal,
  conditions
) {
  if (typeof target === 'string') {
    return resolvePackageTargetString(
      target,
      subpath,
      packageSubpath,
      packageJSONUrl,
      base,
      pattern,
      internal,
      conditions
    );
  } else if (ArrayIsArray(target)) {
    if (target.length === 0) {
      return null;
    }

    let lastException;
    for (let i = 0; i < target.length; i++) {
      const targetItem = target[i];
      let resolveResult;
      try {
        resolveResult = resolvePackageTarget(
          packageJSONUrl,
          targetItem,
          subpath,
          packageSubpath,
          base,
          pattern,
          internal,
          conditions
        );
      } catch (e) {
        lastException = e;
        if (e.code === 'ERR_INVALID_PACKAGE_TARGET') {
          continue;
        }
        throw e;
      }
      if (resolveResult === undefined) {
        continue;
      }
      if (resolveResult === null) {
        lastException = null;
        continue;
      }
      return resolveResult;
    }
    if (lastException === undefined || lastException === null)
      return lastException;
    throw lastException;
  } else if (typeof target === 'object' && target !== null) {
    const keys = ObjectGetOwnPropertyNames(target);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (isArrayIndex(key)) {
        throw new ERR_INVALID_PACKAGE_CONFIG(
          fileURLToPath(packageJSONUrl),
          base,
          '"exports" cannot contain numeric property keys.'
        );
      }
    }
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (key === 'default' || conditions.has(key)) {
        const conditionalTarget = target[key];
        const resolveResult = resolvePackageTarget(
          packageJSONUrl,
          conditionalTarget,
          subpath,
          packageSubpath,
          base,
          pattern,
          internal,
          conditions
        );
        if (resolveResult === undefined) continue;
        return resolveResult;
      }
    }
    return undefined;
  } else if (target === null) {
    return null;
  }
  throwInvalidPackageTarget(
    packageSubpath,
    target,
    packageJSONUrl,
    internal,
    base
  );
}

function patternKeyCompare(a, b) {
  const aPatternIndex = StringPrototypeIndexOf(a, '*');
  const bPatternIndex = StringPrototypeIndexOf(b, '*');
  const baseLenA = aPatternIndex === -1 ? a.length : aPatternIndex + 1;
  const baseLenB = bPatternIndex === -1 ? b.length : bPatternIndex + 1;
  if (baseLenA > baseLenB) return -1;
  if (baseLenB > baseLenA) return 1;
  if (aPatternIndex === -1) return 1;
  if (bPatternIndex === -1) return -1;
  if (a.length > b.length) return -1;
  if (b.length > a.length) return 1;
  return 0;
}

function isConditionalExportsMainSugar(exports, packageJSONUrl, base) {
  if (typeof exports === 'string' || ArrayIsArray(exports)) return true;
  if (typeof exports !== 'object' || exports === null) return false;

  const keys = ObjectGetOwnPropertyNames(exports);
  let isConditionalSugar = false;
  let i = 0;
  for (let j = 0; j < keys.length; j++) {
    const key = keys[j];
    const curIsConditionalSugar = key === '' || key[0] !== '.';
    if (i++ === 0) {
      isConditionalSugar = curIsConditionalSugar;
    } else if (isConditionalSugar !== curIsConditionalSugar) {
      throw new ERR_INVALID_PACKAGE_CONFIG(
        fileURLToPath(packageJSONUrl),
        base,
        '"exports" cannot contain some keys starting with \'.\' and some not.' +
          ' The exports object must either be an object of package subpath keys' +
          ' or an object of main entry condition name keys only.'
      );
    }
  }
  return isConditionalSugar;
}

function throwExportsNotFound(subpath, packageJSONUrl, base) {
  throw new ERR_PACKAGE_PATH_NOT_EXPORTED(
    fileURLToPath(new URL('.', packageJSONUrl)),
    subpath,
    base && fileURLToPath(base)
  );
}

const emittedPackageWarnings = new Set();

function emitTrailingSlashPatternDeprecation(match, pjsonUrl, base) {
  const pjsonPath = fileURLToPath(pjsonUrl);
  if (emittedPackageWarnings.has(pjsonPath + '|' + match)) return;
  emittedPackageWarnings.add(pjsonPath + '|' + match);
  process.emitWarning(
    `Use of deprecated trailing slash pattern mapping "${match}" in the ` +
      `"exports" field module resolution of the package at ${pjsonPath}${
        base ? ` imported from ${fileURLToPath(base)}` : ''
      }. Mapping specifiers ending in "/" is no longer supported.`,
    'DeprecationWarning',
    'DEP0155'
  );
}

function packageExportsResolve({
  packageJSONUrl,
  packageSubpath,
  exports,
  base,
  conditions,
}) {
  if (isConditionalExportsMainSugar(exports, packageJSONUrl, base))
    exports = { '.': exports };

  if (
    ObjectPrototypeHasOwnProperty(exports, packageSubpath) &&
    !StringPrototypeIncludes(packageSubpath, '*') &&
    !StringPrototypeEndsWith(packageSubpath, '/')
  ) {
    const target = exports[packageSubpath];
    const resolveResult = resolvePackageTarget(
      packageJSONUrl,
      target,
      '',
      packageSubpath,
      base,
      false,
      false,
      conditions
    );

    if (resolveResult == null) {
      throwExportsNotFound(packageSubpath, packageJSONUrl, base);
    }

    return resolveResult;
  }

  let bestMatch = '';
  let bestMatchSubpath;
  const keys = ObjectGetOwnPropertyNames(exports);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const patternIndex = StringPrototypeIndexOf(key, '*');
    if (
      patternIndex !== -1 &&
      StringPrototypeStartsWith(
        packageSubpath,
        StringPrototypeSlice(key, 0, patternIndex)
      )
    ) {
      // When this reaches EOL, this can throw at the top of the whole function:
      //
      // if (StringPrototypeEndsWith(packageSubpath, '/'))
      //   throwInvalidSubpath(packageSubpath)
      //
      // To match "imports" and the spec.
      if (StringPrototypeEndsWith(packageSubpath, '/'))
        emitTrailingSlashPatternDeprecation(
          packageSubpath,
          packageJSONUrl,
          base
        );
      const patternTrailer = StringPrototypeSlice(key, patternIndex + 1);
      if (
        packageSubpath.length >= key.length &&
        StringPrototypeEndsWith(packageSubpath, patternTrailer) &&
        patternKeyCompare(bestMatch, key) === 1 &&
        StringPrototypeLastIndexOf(key, '*') === patternIndex
      ) {
        bestMatch = key;
        bestMatchSubpath = StringPrototypeSlice(
          packageSubpath,
          patternIndex,
          packageSubpath.length - patternTrailer.length
        );
      }
    }
  }

  if (bestMatch) {
    const target = exports[bestMatch];
    const resolveResult = resolvePackageTarget(
      packageJSONUrl,
      target,
      bestMatchSubpath,
      bestMatch,
      base,
      true,
      false,
      conditions
    );

    if (resolveResult == null) {
      throwExportsNotFound(packageSubpath, packageJSONUrl, base);
    }
    return resolveResult;
  }

  throwExportsNotFound(packageSubpath, packageJSONUrl, base);
}

function packageImportsResolve({ name, base, conditions, readFileSyncFn }) {
  if (
    name === '#' ||
    StringPrototypeStartsWith(name, '#/') ||
    StringPrototypeEndsWith(name, '/')
  ) {
    const reason = 'is not a valid internal imports specifier name';
    throw new ERR_INVALID_MODULE_SPECIFIER(name, reason, fileURLToPath(base));
  }
  let packageJSONUrl;
  const packageConfig = getPackageScopeConfig(base, readFileSyncFn);
  if (packageConfig.exists) {
    packageJSONUrl = pathToFileURL(packageConfig.pjsonPath);
    const imports = packageConfig.imports;
    if (imports) {
      if (
        ObjectPrototypeHasOwnProperty(imports, name) &&
        !StringPrototypeIncludes(name, '*')
      ) {
        const resolveResult = resolvePackageTarget(
          packageJSONUrl,
          imports[name],
          '',
          name,
          base,
          false,
          true,
          conditions
        );
        if (resolveResult != null) {
          return resolveResult;
        }
      } else {
        let bestMatch = '';
        let bestMatchSubpath;
        const keys = ObjectGetOwnPropertyNames(imports);
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          const patternIndex = StringPrototypeIndexOf(key, '*');
          if (
            patternIndex !== -1 &&
            StringPrototypeStartsWith(
              name,
              StringPrototypeSlice(key, 0, patternIndex)
            )
          ) {
            const patternTrailer = StringPrototypeSlice(key, patternIndex + 1);
            if (
              name.length >= key.length &&
              StringPrototypeEndsWith(name, patternTrailer) &&
              patternKeyCompare(bestMatch, key) === 1 &&
              StringPrototypeLastIndexOf(key, '*') === patternIndex
            ) {
              bestMatch = key;
              bestMatchSubpath = StringPrototypeSlice(
                name,
                patternIndex,
                name.length - patternTrailer.length
              );
            }
          }
        }

        if (bestMatch) {
          const target = imports[bestMatch];
          const resolveResult = resolvePackageTarget(
            packageJSONUrl,
            target,
            bestMatchSubpath,
            bestMatch,
            base,
            true,
            true,
            conditions
          );
          if (resolveResult != null) {
            return resolveResult;
          }
        }
      }
    }
  }
  throwImportNotDefined(name, packageJSONUrl, base);
}

export { packageImportsResolve, packageExportsResolve };
