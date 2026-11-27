import {NativePath, VirtualFS, npath} from '@yarnpkg/fslib';
import path                           from 'path';

import * as nodeUtils                 from '../loader/nodeUtils';

const TYPESCRIPT_EXTENSIONS = new Set([`.ts`, `.mts`, `.cts`]);

// Node.js can read files outside of zip archives and virtual folders itself,
// and decides the format of the ones without a "type" (detecting the module
// syntax since 22.7).
function canNodeLoad(filepath: string) {
  const portablePath = npath.toPortablePath(filepath);
  return !portablePath.includes(`.zip/`) && VirtualFS.resolveVirtual(portablePath) === portablePath;
}

export function tryParseURL(str: string, base?: string | URL | undefined) {
  try {
    return new URL(str, base);
  } catch {
    return null;
  }
}

let entrypointPath: NativePath | null = null;

export function setEntrypointPath(file: NativePath) {
  entrypointPath = file;
}

export function getFileFormat(filepath: string): string | null {
  const ext = path.extname(filepath);

  switch (ext) {
    case `.mjs`: {
      return `module`;
    }
    case `.cjs`: {
      return `commonjs`;
    }
    case `.wasm`: {
      // TODO: Enable if --experimental-wasm-modules is present
      // Waiting on https://github.com/nodejs/node/issues/36935
      throw new Error(
        `Unknown file extension ".wasm" for ${filepath}`,
      );
    }
    case `.json`: {
      return `json`;
    }
    case `.js`: {
      const pkg = nodeUtils.readPackageScope(filepath);
      if (pkg && pkg.data.type)
        return pkg.data.type;
      if (canNodeLoad(filepath))
        return null;
      // assume CJS for files outside of a package boundary
      return `commonjs`;
    }
    // Matching files beyond those handled above deviates from Node's default
    // --experimental-loader behavior but is required to work around
    // https://github.com/nodejs/node/issues/33226
    default: {
      if (entrypointPath !== filepath)
        return null;
      if (TYPESCRIPT_EXTENSIONS.has(ext) && (process.features as {typescript?: string | false}).typescript && canNodeLoad(filepath))
        return null;
      const pkg = nodeUtils.readPackageScope(filepath);
      if (!pkg)
        return `commonjs`;
      // prevent extensions beyond .mjs or .js from loading as ESM
      if (pkg.data.type === `module`)
        return null;
      return pkg.data.type ?? `commonjs`;
    }
  }
}
