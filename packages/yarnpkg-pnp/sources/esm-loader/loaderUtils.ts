import {NativePath}   from '@yarnpkg/fslib';
import fs             from 'fs';
import path           from 'path';
import {URL}          from 'url';

import * as nodeUtils from '../loader/nodeUtils';

export async function tryReadFile(path: NativePath): Promise<string | null> {
  try {
    return await fs.promises.readFile(path, `utf8`);
  } catch (error) {
    if (error.code === `ENOENT`)
      return null;

    throw error;
  }
}

export function tryParseURL(str: string) {
  try {
    return new URL(str);
  } catch {
    return null;
  }
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
      // TODO: Enable if --experimental-json-modules is present
      // Waiting on https://github.com/nodejs/node/issues/36935
      throw new Error(
        `Unknown file extension ".json" for ${filepath}`,
      );
    }
    // Matching files without extensions deviates from Node's default
    // behaviour but is a fix for https://github.com/nodejs/node/issues/33226
    case ``:
    case `.js`: {
      const pkg = nodeUtils.readPackageScope(filepath);
      if (pkg) {
        return pkg.data.type ?? `commonjs`;
      }
    }
  }

  return null;
}
