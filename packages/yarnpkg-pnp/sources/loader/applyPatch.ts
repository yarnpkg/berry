import {FakeFS, PosixFS, npath, ppath, patchFs, PortablePath, xfs, Filename, NativePath} from '@yarnpkg/fslib';
import fs                                                                                from 'fs';
import {Module}                                                                          from 'module';
import path                                                                              from 'path';

import {PackageLocator, PnpApi}                                                          from '../types';

import {ErrorCode, makeError, getIssuerModule}                                           from './internalTools';

export type ApplyPatchOptions = {
  compatibilityMode?: boolean,
  fakeFs: FakeFS<PortablePath>,
};

export type ApiMetadata = {
  cache: typeof Module._cache,
  instance: PnpApi,
  stats: fs.Stats,
};

export function applyPatch(pnpapi: PnpApi, opts: ApplyPatchOptions) {
  // @ts-ignore
  const builtinModules = new Set(Module.builtinModules || Object.keys(process.binding('natives')));

  // The callback function gets called to wrap the return value of the module names matching the regexp
  const patchedModules: Array<[RegExp, (issuer: PackageLocator | null, exports: any) => any]> = [];

  const initialApiPath = npath.toPortablePath(pnpapi.resolveToUnqualified(`pnpapi`, null)!);
  const initialApiStats = opts.fakeFs.statSync(npath.toPortablePath(initialApiPath));

  const defaultCache: typeof Module._cache = {};

  const apiMetadata: Map<PortablePath, ApiMetadata> = new Map([
    [initialApiPath, {
      cache: Module._cache,
      instance: pnpapi,
      stats: initialApiStats,
    }],
  ]);

  if (opts.compatibilityMode !== false) {
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

          opts.paths = function (request: string, basedir: string, getNodeModulesDir: () => Array<string>, opts: any) {
            // Extract the name of the package being requested (1=full name, 2=scope name, 3=local name)
            const parts = request.match(/^((?:(@[^\/]+)\/)?([^\/]+))/);
            if (!parts)
              throw new Error(`Assertion failed: Expected the "resolve" package to call the "paths" callback with package names only (got "${request}")`);

            // make sure that basedir ends with a slash
            if (basedir.charAt(basedir.length - 1) !== '/')
              basedir = path.join(basedir, '/');

            const apiPath = findApiPathFor(basedir);
            if (apiPath === null)
              return getNodeModulesDir();

            const apiEntry = getApiEntry(apiPath, true);
            const api = apiEntry.instance;

            // TODO Handle portable paths
            // This is guaranteed to return the path to the "package.json" file from the given package
            const manifestPath = api.resolveToUnqualified(`${parts[1]}/package.json`, basedir, {
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

  function getRequireStack(parent: Module | null | undefined) {
    const requireStack = [];

    for (let cursor = parent; cursor; cursor = cursor.parent)
      requireStack.push(cursor.filename || cursor.id);

    return requireStack;
  }

  function loadApiInstance(pnpApiPath: PortablePath): PnpApi {
    // @ts-ignore
    const module = new Module(npath.fromPortablePath(pnpApiPath), null);
    module.load(pnpApiPath);
    return module.exports;
  }

  function refreshApiEntry(pnpApiPath: PortablePath, apiEntry: ApiMetadata) {
    const stats = opts.fakeFs.statSync(pnpApiPath);

    if (stats.mtime > apiEntry.stats.mtime) {
      console.warn(`[Warning] The runtime detected new informations in a PnP file; reloading the API instance (${pnpApiPath})`);

      apiEntry.instance = loadApiInstance(pnpApiPath);
      apiEntry.stats = stats;
    }
  }

  function getApiEntry(pnpApiPath: PortablePath, refresh = false) {
    let apiEntry = apiMetadata.get(pnpApiPath);

    if (typeof apiEntry !== `undefined`) {
      if (refresh) {
        refreshApiEntry(pnpApiPath, apiEntry);
      }
    } else {
      apiMetadata.set(pnpApiPath, apiEntry = {
        cache: {},
        instance: loadApiInstance(pnpApiPath),
        stats: opts.fakeFs.statSync(pnpApiPath),
      });
    }

    return apiEntry;
  }

  function findApiPathFor(modulePath: NativePath) {
    let curr: PortablePath;
    let next = npath.toPortablePath(modulePath);

    do {
      curr = next;

      const candidate = ppath.join(curr, `.pnp.js` as Filename);
      if (xfs.existsSync(candidate) && xfs.statSync(candidate).isFile())
        return candidate;

      next = ppath.dirname(curr);
    } while (curr !== PortablePath.root);

    return null;
  }

  function getApiPathFromParent(parent: Module | null | undefined): PortablePath | null {
    if (parent == null)
      return initialApiPath;

    if (typeof parent.pnpApiPath === `undefined`) {
      if (parent.filename !== null) {
        return findApiPathFor(parent.filename);
      } else {
        return initialApiPath;
      }
    }

    if (parent.pnpApiPath !== null)
      return parent.pnpApiPath;

    return null;
  }

  // A small note: we don't replace the cache here (and instead use the native one). This is an effort to not
  // break code similar to "delete require.cache[require.resolve(FOO)]", where FOO is a package located outside
  // of the Yarn dependency tree. In this case, we defer the load to the native loader. If we were to replace the
  // cache by our own, the native loader would populate its own cache, which wouldn't be exposed anymore, so the
  // delete call would be broken.

  const originalModuleLoad = Module._load;

  Module._load = function(request: string, parent: NodeModule | null | undefined, isMain: boolean) {
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

    const parentApiPath = getApiPathFromParent(parent);

    const parentApi = parentApiPath !== null
      ? getApiEntry(parentApiPath, true).instance
      : null;

    // The 'pnpapi' name is reserved to return the PnP api currently in use
    // by the program

    if (parentApi !== null && request === `pnpapi`)
      return parentApi;

    // Request `Module._resolveFilename` (ie. `resolveRequest`) to tell us
    // which file we should load

    const modulePath = Module._resolveFilename(request, parent, isMain);

    // We check whether the module is owned by the dependency tree of the
    // module that required it. If it isn't, then we need to create a new
    // store and possibly load its sandboxed PnP runtime.

    const isOwnedByRuntime = parentApi !== null
      ? parentApi.findPackageLocator(modulePath) !== null
      : false;

    const moduleApiPath = isOwnedByRuntime
      ? parentApiPath
      : findApiPathFor(npath.dirname(modulePath));

    const entry = moduleApiPath !== null
      ? getApiEntry(moduleApiPath)
      : {instance: null, cache: defaultCache};

    // Check if the module has already been created for the given file

    const cacheEntry = entry.cache[modulePath];
    if (cacheEntry)
      return cacheEntry.exports;

    // Create a new module and store it into the cache

    // @ts-ignore
    const module = new Module(modulePath, parent);
    module.pnpApiPath = moduleApiPath;

    entry.cache[modulePath] = module;

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

    if (entry.instance !== null) {
      for (const [filter, patchFn] of patchedModules) {
        if (filter.test(request)) {
          const issuer = parent && parent.filename
            ? entry.instance.findPackageLocator(parent.filename)
            : null;

          module.exports = patchFn(issuer, module.exports);
        }
      }
    }

    return module.exports;
  };

  const originalModuleResolveFilename = Module._resolveFilename;

  Module._resolveFilename = function(request: string, parent: NodeModule | null | undefined, isMain: boolean, options?: {[key: string]: any}) {
    if (builtinModules.has(request))
      return request;

    if (!enableNativeHooks)
      return originalModuleResolveFilename.call(Module, request, parent, isMain, options);

    if (options && options.plugnplay === false) {
      const {plugnplay, ...rest} = options;

      // Workaround a bug present in some version of Node (now fixed)
      // https://github.com/nodejs/node/pull/28078
      const forwardedOptions = Object.keys(rest).length > 0
        ? rest
        : undefined;

      try {
        enableNativeHooks = false;
        return originalModuleResolveFilename.call(Module, request, parent, isMain, forwardedOptions);
      } finally {
        enableNativeHooks = true;
      }
    }

    // We check that all the options present here are supported; better
    // to fail fast than to introduce subtle bugs in the runtime.

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
    }

    const getIssuerSpecsFromPaths = (paths: Array<NativePath>) => {
      return paths.map(path => ({
        apiPath: findApiPathFor(path),
        path: npath.toPortablePath(path),
        module: null,
      }));
    };

    const getIssuerSpecsFromModule = (module: NodeModule | null | undefined) => {
      const issuer = getIssuerModule(module);

      const issuerPath = issuer !== null
        ? npath.dirname(issuer.filename)
        : process.cwd();

      return [{
        apiPath: getApiPathFromParent(issuer),
        path: npath.toPortablePath(issuerPath),
        module,
      }];
    };

    const makeFakeParent = (path: PortablePath) => {
      const fakeParent = new Module(``);

      const fakeFilePath = ppath.join(path, `[file]` as Filename);
      fakeParent.paths = Module._nodeModulePaths(npath.fromPortablePath(fakeFilePath));

      return fakeParent;
    };

    const issuerSpecs = options && options.paths
      ? getIssuerSpecsFromPaths(options.paths)
      : getIssuerSpecsFromModule(parent);

    let firstError;

    for (const {apiPath, path, module} of issuerSpecs) {
      let resolution;

      const issuerApi = apiPath !== null
        ? getApiEntry(apiPath, true).instance
        : null;

      try {
        if (issuerApi !== null) {
          resolution = issuerApi.resolveRequest(request, `${path}/`);
        } else {
          resolution = originalModuleResolveFilename.call(Module, request, module || makeFakeParent(path), isMain);
        }
      } catch (error) {
        firstError = firstError || error;
        continue;
      }

      if (resolution !== null) {
        return resolution;
      }
    }

    const requireStack = getRequireStack(parent);
    firstError.requireStack = requireStack;

    if (requireStack.length > 0)
      firstError.message += `\nRequire stack:\n- ${requireStack.join(`\n- `)}`;

    throw firstError;
  };

  const originalFindPath = Module._findPath;

  Module._findPath = function(request: string, paths: Array<string> | null | undefined, isMain: boolean) {
    if (request === `pnpapi`)
      return false;

    if (!enableNativeHooks)
      return originalFindPath.call(Module, request, paths, isMain);

    for (const path of paths || []) {
      let resolution: string | false;

      try {
        const pnpApiPath = findApiPathFor(path);
        if (pnpApiPath !== null) {
          const api = getApiEntry(pnpApiPath, true).instance;
          resolution = api.resolveRequest(request, path) || false;
        } else {
          resolution = originalFindPath.call(Module, request, [path], isMain);
        }
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
