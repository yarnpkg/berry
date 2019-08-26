import {FakeFS, NodeFS, PosixFS, patchFs, PortablePath} from '@yarnpkg/fslib';
import fs                                               from 'fs';
import Module                                           from 'module';
import path                                             from 'path';

import {PackageLocator, PnpApi}                         from '../types';

import {ErrorCode, makeError, getIssuerModule}          from './internalTools';

export type ApplyPatchOptions = {
  compatibilityMode?: boolean,
  fakeFs: FakeFS<PortablePath>,
};

export function applyPatch(pnpapi: PnpApi, opts: ApplyPatchOptions) {
  // @ts-ignore
  const builtinModules = new Set(Module.builtinModules || Object.keys(process.binding('natives')));

  // The callback function gets called to wrap the return value of the module names matching the regexp
  const patchedModules: Array<[RegExp, (issuer: PackageLocator | null, exports: any) => any]> = [];

  if (opts.compatibilityMode) {
    // Modern versions of `resolve` support a specific entry point that custom resolvers can use
    // to inject a specific resolution logic without having to patch the whole package.
    //
    // Cf: https://github.com/browserify/resolve/pull/174

    patchedModules.push([
      /^\.\/normalize-options\.js$/,
      (issuer, normalizeOptions) => {
        if (!issuer || issuer.name !== 'resolve')
          return normalizeOptions;

        return (request: string, opts: {[key: string]: any}) => {
          opts = opts || {};

          if (opts.forceNodeResolution)
            return opts;

          opts.preserveSymlinks = true;
          opts.paths = function (request: string, basedir: string, getNodeModulesDir: () => Array<string>, opts: any) {
            // Extract the name of the package being requested (1=full name, 2=scope name, 3=local name)
            const parts = request.match(/^((?:(@[^\/]+)\/)?([^\/]+))/);
            if (!parts)
              throw new Error(`Assertion failed: Expected the "resolve" package to call the "paths" callback with package names only (got "${request}")`);

            // make sure that basedir ends with a slash
            if (basedir.charAt(basedir.length - 1) !== '/')
              basedir = path.join(basedir, '/');

            // TODO Handle portable paths
            // This is guaranteed to return the path to the "package.json" file from the given package
            const manifestPath = pnpapi.resolveToUnqualified(`${parts[1]}/package.json`, basedir, {
              considerBuiltins: false,
            });

            if (manifestPath === null)
              throw new Error(`Assertion failed: The resolution thinks that "${parts[1]}" is a Node builtin`);

            // The first dirname strips the package.json, the second strips the local named folder
            let nodeModules = path.dirname(path.dirname(manifestPath));

            // Strips the scope named folder if needed
            if (parts[2])
              nodeModules = path.dirname(nodeModules);

            return [nodeModules];
          };

          return opts;
        };
      },
    ]);
  }

  /**
   * Used to disable the resolution hooks (for when we want to fallback to the previous resolution - we then need
   * a way to "reset" the environment temporarily)
   */

  let enableNativeHooks = true;

  // @ts-ignore
  process.versions.pnp = String(pnpapi.VERSIONS.std);

  // A small note: we don't replace the cache here (and instead use the native one). This is an effort to not
  // break code similar to "delete require.cache[require.resolve(FOO)]", where FOO is a package located outside
  // of the Yarn dependency tree. In this case, we defer the load to the native loader. If we were to replace the
  // cache by our own, the native loader would populate its own cache, which wouldn't be exposed anymore, so the
  // delete call would be broken.

  const originalModuleLoad = Module._load;

  Module._load = function(request: string, parent: NodeModule | null, isMain: boolean) {
    if (!enableNativeHooks)
      return originalModuleLoad.call(Module, request, parent, isMain);

    // Builtins are managed by the regular Node loader

    if (builtinModules.has(request)) {
      try {
        enableNativeHooks = false;
        return originalModuleLoad.call(Module, request, parent, isMain);
      } finally {
        enableNativeHooks = true;
      }
    }

    // The 'pnpapi' name is reserved to return the PnP api currently in use by the program

    if (request === `pnpapi`)
      return pnpapi;

    // Request `Module._resolveFilename` (ie. `resolveRequest`) to tell us which file we should load

    const modulePath = Module._resolveFilename(request, parent, isMain);

    // Check if the module has already been created for the given file

    const cacheEntry = Module._cache[modulePath];

    if (cacheEntry)
      return cacheEntry.exports;

    // Create a new module and store it into the cache

    // @ts-ignore
    const module = new Module(modulePath, parent);
    Module._cache[modulePath] = module;

    // The main module is exposed as global variable

    if (isMain) {
      // @ts-ignore
      process.mainModule = module;
      module.id = '.';
    }

    // Try to load the module, and remove it from the cache if it fails

    let hasThrown = true;

    try {
      module.load(modulePath);
      hasThrown = false;
    } finally {
      if (hasThrown) {
        delete Module._cache[modulePath];
      }
    }

    // Some modules might have to be patched for compatibility purposes

    for (const [filter, patchFn] of patchedModules) {
      if (filter.test(request)) {
        const issuer = parent && parent.filename ? pnpapi.findPackageLocator(parent.filename) : null;
        module.exports = patchFn(issuer, module.exports);
      }
    }

    return module.exports;
  };

  const originalModuleResolveFilename = Module._resolveFilename;

  Module._resolveFilename = function(request: string, parent: NodeModule | null, isMain: boolean, options?: {[key: string]: any}) {
    if (request === `pnpapi`)
      return request;

    if (!enableNativeHooks)
      return originalModuleResolveFilename.call(Module, request, parent, isMain, options);

    if (options && options.plugnplay === false) {
      try {
        enableNativeHooks = false;
        return originalModuleResolveFilename.call(Module, request, parent, isMain, options);
      } finally {
        enableNativeHooks = true;
      }
    }

    let issuers;

    if (options) {
      const optionNames = new Set(Object.keys(options));
      optionNames.delete(`paths`);
      optionNames.delete(`plugnplay`);

      if (optionNames.size > 0) {
        throw makeError(
          ErrorCode.UNSUPPORTED,
          `Some options passed to require() aren't supported by PnP yet (${Array.from(optionNames).join(', ')})`
        );
      }

      if (options.paths) {
        issuers = options.paths.map((entry: string) => {
          return `${path.normalize(entry)}/`;
        });
      }
    }

    if (!issuers) {
      const issuerModule = getIssuerModule(parent);
      const issuer = issuerModule ? issuerModule.filename : `${NodeFS.toPortablePath(process.cwd())}/`;

      issuers = [issuer];
    }

    // When Node is called, it tries to require the main script but can't
    // because PnP already patched 'Module'
    // We test it for an absolute Windows path and convert it to a portable path.
    // We should probably always call toPortablePath and check for this directly
    if (/^[A-Z]:.*/.test(request))
      request = NodeFS.toPortablePath(request);

    let firstError;

    for (const issuer of issuers) {
      let resolution;

      try {
        resolution = pnpapi.resolveRequest(request, issuer);
      } catch (error) {
        firstError = firstError || error;
        continue;
      }

      return resolution !== null ? resolution : request;
    }

    throw firstError;
  };

  const originalFindPath = Module._findPath;

  Module._findPath = function(request: string, paths: Array<string>, isMain: boolean) {
    if (request === `pnpapi`)
      return false;

    if (!enableNativeHooks)
      return originalFindPath.call(Module, request, paths, isMain);

    for (const path of paths) {
      let resolution;

      try {
        // TODO Convert path to portable path?
        resolution = pnpapi.resolveRequest(request, path);
      } catch (error) {
        continue;
      }

      if (resolution) {
        return resolution;
      }
    }

    return false;
  };

  patchFs(fs, new PosixFS(opts.fakeFs));
};
