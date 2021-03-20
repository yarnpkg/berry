import {PnpApi}                                                                             from '@yarnpkg/pnp';
import type {OnLoadArgs, OnLoadResult, OnResolveArgs, OnResolveResult, Plugin, PluginBuild} from 'esbuild';
import * as fs                                                                              from 'fs';

const matchAll = /()/;
const defaultExtensions = [`.tsx`, `.ts`, `.jsx`, `.mjs`, `.cjs`, `.js`, `.css`, `.json`];

async function defaultOnLoad(args: OnLoadArgs): Promise<OnLoadResult> {
  return {
    contents: await fs.promises.readFile(args.path, `utf8`),
    loader: `default`,
  };
}

async function defaultOnResolve(args: OnResolveArgs, resolvedPath: string | null): Promise<OnResolveResult> {
  if (resolvedPath !== null) {
    return {namespace: `pnp`, path: resolvedPath};
  } else {
    return {external: true};
  }
}

export type PluginOptions = {
  baseDir?: string,
  extensions?: Array<string>,
  filter?: RegExp,
  onResolve?: (args: OnResolveArgs, resolvedPath: string | null) => Promise<OnResolveResult | null>,
  onLoad?: (args: OnLoadArgs) => Promise<OnLoadResult>,
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

      build.onResolve({filter}, args => {
        // The entry point resolution uses an empty string
        const effectiveImporter = args.importer
          ? args.importer
          : `${baseDir}/`;

        const pnpApi = findPnpApi(effectiveImporter) as PnpApi | null;
        if (!pnpApi)
          // Path isn't controlled by PnP so delegate to the next resolver in the chain
          return undefined;

        const path = pnpApi.resolveRequest(args.path, effectiveImporter, {
          considerBuiltins: true,
          extensions,
        });

        return onResolve(args, path);
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
