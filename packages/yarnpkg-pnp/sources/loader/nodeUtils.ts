import {NativePath, npath} from '@yarnpkg/fslib';
import fs                  from 'fs';
import {Module}            from 'module';

// https://github.com/nodejs/node/blob/e817ba70f56c4bfd5d4a68dce8b165142312e7b6/lib/internal/modules/run_main.js#L11-L24
export function resolveMainPath(main: NativePath) {
  let mainPath = Module._findPath(npath.resolve(main), null, true);
  if (!mainPath)
    return false;

  // const preserveSymlinksMain = getOptionValue(`--preserve-symlinks-main`);
  // if (!preserveSymlinksMain)
  mainPath = fs.realpathSync(mainPath);

  return mainPath;
}

// https://github.com/nodejs/node/blob/e817ba70f56c4bfd5d4a68dce8b165142312e7b6/lib/internal/modules/run_main.js#L26-L41
export function shouldUseESMLoader(mainPath: NativePath) {
  // const userLoader = getOptionValue(`--experimental-loader`);
  // if (userLoader)
  //   return true;
  // const esModuleSpecifierResolution =
  //   getOptionValue(`--experimental-specifier-resolution`);
  // if (esModuleSpecifierResolution === `node`)
  //   return true;
  // Determine the module format of the main
  if (mainPath && mainPath.endsWith(`.mjs`))
    return true;
  if (!mainPath || mainPath.endsWith(`.cjs`))
    return false;
  const pkg = readPackageScope(mainPath);
  return pkg && pkg.data.type === `module`;
}

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
