import { fileURLToPath } from 'url';

import { ERR_INVALID_PACKAGE_CONFIG } from './errors.js';
import { filterOwnProperties } from './util.js';

import {
  SafeMap,
  JSONParse,
  ObjectPrototypeHasOwnProperty,
  StringPrototypeEndsWith,
} from './primordials.js';

const packageJSONCache = new SafeMap();

function getPackageConfig(path, specifier, base, readFileSyncFn) {
  const existing = packageJSONCache.get(path);
  if (existing !== undefined) {
    return existing;
  }
  const source = readFileSyncFn(path);
  if (source === undefined) {
    const packageConfig = {
      pjsonPath: path,
      exists: false,
      main: undefined,
      name: undefined,
      type: 'none',
      exports: undefined,
      imports: undefined,
    };
    packageJSONCache.set(path, packageConfig);
    return packageConfig;
  }

  let packageJSON;
  try {
    packageJSON = JSONParse(source);
  } catch (error) {
    throw new ERR_INVALID_PACKAGE_CONFIG(
      path,
      (base ? `"${specifier}" from ` : '') + fileURLToPath(base || specifier),
      error.message
    );
  }

  let { imports, main, name, type } = filterOwnProperties(packageJSON, [
    'imports',
    'main',
    'name',
    'type',
  ]);
  const exports = ObjectPrototypeHasOwnProperty(packageJSON, 'exports')
    ? packageJSON.exports
    : undefined;
  if (typeof imports !== 'object' || imports === null) {
    imports = undefined;
  }
  if (typeof main !== 'string') {
    main = undefined;
  }
  if (typeof name !== 'string') {
    name = undefined;
  }
  // Ignore unknown types for forwards compatibility
  if (type !== 'module' && type !== 'commonjs') {
    type = 'none';
  }

  const packageConfig = {
    pjsonPath: path,
    exists: true,
    main,
    name,
    type,
    exports,
    imports,
  };
  packageJSONCache.set(path, packageConfig);
  return packageConfig;
}

export function getPackageScopeConfig(resolved, readFileSyncFn) {
  let packageJSONUrl = new URL('./package.json', resolved);
  while (true) {
    const packageJSONPath = packageJSONUrl.pathname;
    if (StringPrototypeEndsWith(packageJSONPath, 'node_modules/package.json')) {
      break;
    }
    const packageConfig = getPackageConfig(
      fileURLToPath(packageJSONUrl),
      resolved,
      undefined,
      readFileSyncFn
    );
    if (packageConfig.exists) {
      return packageConfig;
    }

    const lastPackageJSONUrl = packageJSONUrl;
    packageJSONUrl = new URL('../package.json', packageJSONUrl);

    // Terminates at root where ../package.json equals ../../package.json
    // (can't just check "/package.json" for Windows support).
    if (packageJSONUrl.pathname === lastPackageJSONUrl.pathname) {
      break;
    }
  }
  const packageJSONPath = fileURLToPath(packageJSONUrl);
  const packageConfig = {
    pjsonPath: packageJSONPath,
    exists: false,
    main: undefined,
    name: undefined,
    type: 'none',
    exports: undefined,
    imports: undefined,
  };
  packageJSONCache.set(packageJSONPath, packageConfig);
  return packageConfig;
}
