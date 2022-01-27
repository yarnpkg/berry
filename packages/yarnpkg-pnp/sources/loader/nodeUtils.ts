import {NativePath, npath} from '@yarnpkg/fslib';
import fs                  from 'fs';
import {Module}            from 'module';
import path                from 'path';

// @ts-expect-error
const builtinModules = new Set(Module.builtinModules || Object.keys(process.binding(`natives`)));

export const isBuiltinModule = (request: string) => request.startsWith(`node:`) || builtinModules.has(request);

// https://github.com/nodejs/node/blob/e817ba70f56c4bfd5d4a68dce8b165142312e7b6/lib/internal/modules/cjs/loader.js#L315-L330
export function readPackageScope(checkPath: NativePath) {
  const rootSeparatorIndex = checkPath.indexOf(npath.sep);
  let separatorIndex;
  do {
    separatorIndex = checkPath.lastIndexOf(npath.sep);
    checkPath = checkPath.slice(0, separatorIndex);
    if (checkPath.endsWith(`${npath.sep}node_modules`))
      return false;
    const pjson = readPackage(checkPath + npath.sep);
    if (pjson) {
      return {
        data: pjson,
        path: checkPath,
      };
    }
  } while (separatorIndex > rootSeparatorIndex);
  return false;
}

// https://github.com/nodejs/node/blob/e817ba70f56c4bfd5d4a68dce8b165142312e7b6/lib/internal/modules/cjs/loader.js#L284-L313
export function readPackage(requestPath: NativePath) {
  const jsonPath = npath.resolve(requestPath, `package.json`);

  if (!fs.existsSync(jsonPath))
    return null;

  return JSON.parse(fs.readFileSync(jsonPath, `utf8`));
}

// https://github.com/nodejs/node/blob/972d9218559877f7fff4bb6086afacac8933f8d1/lib/internal/errors.js#L1450-L1478
// Our error isn't as detailed since we don't have access to acorn to check
// if the file contains ESM syntax
export function ERR_REQUIRE_ESM(filename: string, parentPath: string | null = null) {
  const basename =
    parentPath && path.basename(filename) === path.basename(parentPath)
      ? filename
      : path.basename(filename);

  const msg =
    `require() of ES Module ${filename}${parentPath ? ` from ${parentPath}` : ``} not supported.
Instead change the require of ${basename} in ${parentPath} to a dynamic import() which is available in all CommonJS modules.`;

  const err = new Error(msg) as Error & { code: string };
  err.code = `ERR_REQUIRE_ESM`;
  return err;
}
