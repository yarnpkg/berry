import {NativePath, npath} from '@yarnpkg/fslib';
import fs                  from 'fs';
import {Module}            from 'module';

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
