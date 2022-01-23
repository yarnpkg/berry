import {PnpApi}                                                                             from '@yarnpkg/pnp';
import type {OnLoadArgs, OnLoadResult, OnResolveArgs, OnResolveResult, Plugin, PluginBuild} from 'esbuild';
import * as fs                                                                              from 'fs';

const matchAll = /()/;
const defaultExtensions = [`.tsx`, `.ts`, `.jsx`, `.mjs`, `.cjs`, `.js`, `.css`, `.json`];

type External = string | {prefix: string, suffix: string};

// Reference: https://github.com/evanw/esbuild/blob/537195ae84bee1510fac14235906d588084c39cd/pkg/api/api_impl.go#L366-L388
function parseExternals(externals: Array<string>): Array<External> {
  return externals.map(external => {
    // ESBuild's validation pass runs before this function is called so there's no need to assert that there's a single wildcard
    const wildcardIdx = external.indexOf(`*`);
    if (wildcardIdx !== -1)
      return {prefix: external.slice(0, wildcardIdx), suffix: external.slice(wildcardIdx + 1)};

    return external;
  });
}

function isExternal(path: string, externals: Array<External>): boolean {
  for (const external of externals) {
    if (typeof external === `object`) {
      // Reference: https://github.com/evanw/esbuild/blob/537195ae84bee1510fac14235906d588084c39cd/internal/resolver/resolver.go#L372-L381
      if (
        path.length >= external.prefix.length + external.suffix.length
        && path.startsWith(external.prefix)
        && path.endsWith(external.suffix)
      ) {
        return true;
      }
    } else {
      if (path === external) {
        return true;
      }
    }
  }

  return false;
}

async function defaultOnLoad(args: OnLoadArgs): Promise<OnLoadResult> {
  return {
    contents: await fs.promises.readFile(args.path),
    loader: `default`,
  };
}

type OnResolveParams = {
  resolvedPath: string | null;
  watchFiles: Array<string>;
  error?: Error;
};

async function defaultOnResolve(args: OnResolveArgs, {resolvedPath, error, watchFiles}: OnResolveParams): Promise<OnResolveResult> {
  const problems = error ? [{text: error.message}] : [];

  // Sometimes dynamic resolve calls might be wrapped in a try / catch,
  // but ESBuild neither skips them nor does it provide a way for us to tell.
  // Because of that, we downgrade all errors to warnings in these situations.
  // Issue: https://github.com/evanw/esbuild/issues/1127
  let mergeWith;
  switch (args.kind) {
    case `require-call`:
    case `require-resolve`:
    case `dynamic-import`: {
      mergeWith = {warnings: problems};
    } break;

    default: {
      mergeWith = {errors: problems};
    } break;
  }

  if (resolvedPath !== null) {
    return {namespace: `pnp`, path: resolvedPath, watchFiles};
  } else {
    return {external: true, ...mergeWith, watchFiles};
  }
}

export type PluginOptions = {
  baseDir?: string;
  extensions?: Array<string>;
  filter?: RegExp;
  onResolve?: (args: OnResolveArgs, params: OnResolveParams) => Promise<OnResolveResult | null>;
  onLoad?: (args: OnLoadArgs) => Promise<OnLoadResult>;
};

export function pnpPlugin({
  baseDir = process.cwd(),
  extensions = defaultExtensions,
  filter = matchAll,
  onResolve = defaultOnResolve,
  onLoad = defaultOnLoad,
}: PluginOptions = {}): Plugin {
  return {
    name: `@yarnpkg/esbuild-plugin-pnp`,
    setup(build: PluginBuild) {
      const {findPnpApi} = require(`module`);
      if (typeof findPnpApi === `undefined`)
        return;

      const externals = parseExternals(build.initialOptions.external ?? []);

      const isPlatformNode = (build.initialOptions.platform ?? `browser`) === `node`;

      build.onResolve({filter}, args => {
        if (isExternal(args.path, externals))
          return {external: true};

        // The entry point resolution uses an empty string
        const effectiveImporter = args.importer
          ? args.importer
          : `${baseDir}/`;

        const pnpApi = findPnpApi(effectiveImporter) as PnpApi | null;
        if (!pnpApi)
          // Path isn't controlled by PnP so delegate to the next resolver in the chain
          return undefined;

        let path = null;
        let error;
        try {
          path = pnpApi.resolveRequest(args.path, effectiveImporter, {
            considerBuiltins: isPlatformNode,
            extensions,
          });
        } catch (e) {
          error = e;
        }

        const watchFiles: Array<string> = [pnpApi.resolveRequest(`pnpapi`, null)!];

        if (path) {
          const locator = pnpApi.findPackageLocator(path);
          if (locator) {
            const info = pnpApi.getPackageInformation(locator);

            if (info?.linkType === `SOFT`) {
              watchFiles.push(pnpApi.resolveVirtual?.(path) ?? path);
            }
          }
        }

        return onResolve(args, {resolvedPath: path, error, watchFiles});
      });

      // We register on the build to prevent ESBuild from reading the files
      // itself, since it wouldn't know how to access the files from within
      // the zip archives.
      if (build.onLoad !== null) {
        build.onLoad({filter}, onLoad);
      }
    },
  };
}
