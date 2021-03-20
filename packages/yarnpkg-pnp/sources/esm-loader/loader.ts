import {parse, init}                       from 'cjs-module-lexer';
import fs                                  from 'fs';
import * as moduleExports                  from 'module';
import path                                from 'path';
import {fileURLToPath, pathToFileURL, URL} from 'url';

import {PnpApi}                            from '../types';

function isValidURL(str: string) {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

const builtins = new Set([...moduleExports.builtinModules]);

// @ts-expect-error - This module, when bundled, is still ESM so this is valid
const pnpapi: PnpApi = moduleExports.createRequire(import.meta.url)(`pnpapi`);

export async function resolve(
  specifier: string,
  context: any,
  defaultResolver: any
) {
  let validURL;
  if (builtins.has(specifier) || (validURL = isValidURL(specifier))) {
    if (!validURL || pathToFileURL(specifier).protocol !== `file:`) {
      return defaultResolver(specifier, context, defaultResolver);
    } else {
      specifier = fileURLToPath(specifier);
    }
  }

  const {parentURL, conditions = []} = context;

  const parentPath = parentURL ? fileURLToPath(parentURL) : process.cwd();

  const result = pnpapi.resolveRequest(specifier, parentPath, {
    conditions: new Set(conditions),
    // TODO: Handle --experimental-specifier-resolution=node
    extensions: [],
  });

  if (!result)
    throw new Error(`Resolution failed`);

  return {
    url: pathToFileURL(result).href,
  };
}

const realModules = new Set<string>();

export async function getFormat(
  resolved: string,
  context: any,
  defaultGetFormat: any
) {
  const parsedURL = new URL(resolved);
  if (parsedURL.protocol !== `file:`)
    return defaultGetFormat(resolved, context, defaultGetFormat);

  switch (path.extname(parsedURL.pathname)) {
    case `.mjs`: {
      realModules.add(fileURLToPath(resolved));
      return {
        format: `module`,
      };
    }
    case `.json`: {
      // TODO: Enable if --experimental-json-modules is present
      throw new Error(
        `Unknown file extension ".json" for ${fileURLToPath(resolved)}`
      );
      return {
        format: `module`,
      };
    }
    default: {
      let packageJSONUrl = new URL(`./package.json`, resolved);
      while (true) {
        if (packageJSONUrl.pathname.endsWith(`node_modules/package.json`))
          break;

        const filePath = fileURLToPath(packageJSONUrl);

        try {
          let moduleType =
            JSON.parse(await fs.promises.readFile(filePath, `utf8`)).type ??
            `commonjs`;
          if (moduleType === `commonjs`) moduleType = `module`;
          else realModules.add(fileURLToPath(resolved));

          return {
            format: moduleType,
          };
        } catch {}

        const lastPackageJSONUrl = packageJSONUrl;
        packageJSONUrl = new URL(`../package.json`, packageJSONUrl);

        if (packageJSONUrl.pathname === lastPackageJSONUrl.pathname) {
          break;
        }
      }
    }
  }

  throw new Error(`Unable to get module type of '${resolved}'`);
}

let parserInit: Promise<void> | null = init().then(() => {
  parserInit = null;
});

async function parseExports(filePath: string) {
  const {exports} = parse(await fs.promises.readFile(filePath, `utf8`));

  return new Set(exports);
}

export async function getSource(
  urlString: string,
  context: any,
  defaultGetSource: any
) {
  const url = new URL(urlString);
  if (url.protocol !== `file:`)
    return defaultGetSource(url, context, defaultGetSource);

  urlString = fileURLToPath(urlString);

  if (realModules.has(urlString)) {
    return {
      source: await fs.promises.readFile(urlString, `utf8`),
    };
  }

  if (parserInit !== null) await parserInit;

  const exports = await parseExports(urlString);

  let exportStrings = `export default cjs\n`;
  for (const exportName of exports) {
    if (exportName !== `default`) {
      exportStrings += `const __${exportName} = cjs['${exportName}'];\n export { __${exportName} as ${exportName} }\n`;
    }
  }

  const fakeModulePath = path.join(path.dirname(urlString), `noop.js`);

  const code = `
  import {createRequire} from 'module';
  const require = createRequire('${fakeModulePath.replace(/\\/g, `/`)}');
  const cjs = require('${urlString.replace(/\\/g, `/`)}');

  ${exportStrings}
  `;

  return {
    source: code,
  };
}
