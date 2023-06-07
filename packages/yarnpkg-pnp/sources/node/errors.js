import assert from 'assert';

import { StringPrototypeStartsWith, JSONStringify } from './primordials.js';

function createErrorType(code, messageCreator, errorType) {
  return class extends errorType {
    constructor(...args) {
      super(messageCreator(...args));
      this.code = code;
      this.name = `${errorType.name} [${code}]`;
    }
  };
}

export const ERR_PACKAGE_IMPORT_NOT_DEFINED = createErrorType(
  `ERR_PACKAGE_IMPORT_NOT_DEFINED`,
  (specifier, packagePath, base) => {
    return `Package import specifier "${specifier}" is not defined${
      packagePath ? ` in package ${packagePath}package.json` : ``
    } imported from ${base}`;
  },
  TypeError
);

export const ERR_INVALID_MODULE_SPECIFIER = createErrorType(
  `ERR_INVALID_MODULE_SPECIFIER`,
  (request, reason, base = undefined) => {
    return `Invalid module "${request}" ${reason}${
      base ? ` imported from ${base}` : ``
    }`;
  },
  TypeError
);

export const ERR_INVALID_PACKAGE_TARGET = createErrorType(
  `ERR_INVALID_PACKAGE_TARGET`,
  (pkgPath, key, target, isImport = false, base = undefined) => {
    const relError =
      typeof target === `string` &&
      !isImport &&
      target.length &&
      !StringPrototypeStartsWith(target, `./`);
    if (key === `.`) {
      assert(isImport === false);
      return (
        `Invalid "exports" main target ${JSONStringify(target)} defined ` +
        `in the package config ${pkgPath}package.json${
          base ? ` imported from ${base}` : ``
        }${relError ? `; targets must start with "./"` : ``}`
      );
    }
    return `Invalid "${
      isImport ? `imports` : `exports`
    }" target ${JSONStringify(
      target
    )} defined for '${key}' in the package config ${pkgPath}package.json${
      base ? ` imported from ${base}` : ``
    }${relError ? `; targets must start with "./"` : ``}`;
  },
  Error
);

export const ERR_INVALID_PACKAGE_CONFIG = createErrorType(
  `ERR_INVALID_PACKAGE_CONFIG`,
  (path, base, message) => {
    return `Invalid package config ${path}${
      base ? ` while importing ${base}` : ``
    }${message ? `. ${message}` : ``}`;
  },
  Error
);

export const ERR_PACKAGE_PATH_NOT_EXPORTED = createErrorType(
  'ERR_PACKAGE_PATH_NOT_EXPORTED',
  (pkgPath, subpath, base = undefined) => {
    if (subpath === '.')
      return `No "exports" main defined in ${pkgPath}package.json${
        base ? ` imported from ${base}` : ''
      }`;
    return `Package subpath '${subpath}' is not defined by "exports" in ${pkgPath}package.json${
      base ? ` imported from ${base}` : ''
    }`;
  },
  Error
);
