import {FakeFS, PosixFS, npath, patchFs, PortablePath, NativePath} from '@yarnpkg/fslib';
import fs                                                          from 'fs';
import {Module}                                                    from 'module';
import {URL, fileURLToPath}                                        from 'url';

import {PnpApi}                                                    from '../types';

import {ErrorCode, makeError, getIssuerModule}                     from './internalTools';
import {Manager}                                                   from './makeManager';
import * as nodeUtils                                              from './nodeUtils';

export type ApplyPatchOptions = {
  fakeFs: FakeFS<PortablePath>;
  manager: Manager;
};

type PatchedModule = Module & {
  load(path: NativePath): void;
  isLoading?: boolean;
};

export function applyPatch(pnpapi: PnpApi, opts: ApplyPatchOptions) {
  /**
   * The cache that will be used for all accesses occurring outside of a PnP context.
   */

  const defaultCache: NodeJS.NodeRequireCache = {};

  /**
   * Used to disable the resolution hooks (for when we want to fallback to the previous resolution - we then need
   * a way to "reset" the environment temporarily)
   */

  let enableNativeHooks = true;

  // @ts-expect-error
  process.versions.pnp = String(pnpapi.VERSIONS.std);

  const moduleExports = require(`module`);

  moduleExports.findPnpApi = (lookupSource: URL | NativePath) => {
    const lookupPath = lookupSource instanceof URL
      ? fileURLToPath(lookupSource)
      : lookupSource;

    const apiPath = opts.manager.findApiPathFor(lookupPath);
    if (apiPath === null)
      return null;

    const apiEntry = opts.manager.getApiEntry(apiPath, true);
    // Check if the path is ignored
    return apiEntry.instance.findPackageLocator(lookupPath) ? apiEntry.instance : null;
  };

  function getRequireStack(parent: Module | null | undefined) {
    const requireStack = [];

    for (let cursor = parent; cursor; cursor = cursor.parent)
      requireStack.push(cursor.filename || cursor.id);

    return requireStack;
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

    if (nodeUtils.isBuiltinModule(request)) {
      try {
        enableNativeHooks = false;
        return originalModuleLoad.call(Module, request, parent, isMain);
      } finally {
        enableNativeHooks = true;
      }
    }

    const parentApiPath = opts.manager.getApiPathFromParent(parent);

    const parentApi = parentApiPath !== null
      ? opts.manager.getApiEntry(parentApiPath, true).instance
      : null;

    // Requests that aren't covered by the PnP runtime goes through the
    // parent `_load` implementation. This is required for VSCode, for example,
    // which override `_load` to provide additional builtins to its extensions.

    if (parentApi === null)
      return originalModuleLoad(request, parent, isMain);

    // The 'pnpapi' name is reserved to return the PnP api currently in use
    // by the program

    if (request === `pnpapi`)
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
      : opts.manager.findApiPathFor(npath.dirname(modulePath));

    const entry = moduleApiPath !== null
      ? opts.manager.getApiEntry(moduleApiPath)
      : {instance: null, cache: defaultCache};

    // Check if the module has already been created for the given file

    const cacheEntry = entry.cache[modulePath] as PatchedModule | undefined;
    if (cacheEntry) {
      // When the Node ESM loader encounters CJS modules it adds them
      // to the cache but doesn't load them so we do that here.
      //
      // Keep track of and check if the module is already loading to
      // handle circular requires.
      //
      // The explicit checks are required since `@babel/register` et al.
      // create modules without the `loaded` and `load` properties
      if (cacheEntry.loaded === false && cacheEntry.isLoading !== true) {
        try {
          cacheEntry.isLoading = true;

          // The main module is exposed as a global variable
          if (isMain) {
            process.mainModule = cacheEntry;
            cacheEntry.id = `.`;
          }

          cacheEntry.load(modulePath);
        } finally {
          cacheEntry.isLoading = false;
        }
      }

      return cacheEntry.exports;
    }

    // Create a new module and store it into the cache

    const module = new Module(modulePath, parent ?? undefined) as PatchedModule;
    module.pnpApiPath = moduleApiPath;

    entry.cache[modulePath] = module;

    // The main module is exposed as a global variable
    if (isMain) {
      process.mainModule = module;
      module.id = `.`;
    }

    // Try to load the module, and remove it from the cache if it fails

    let hasThrown = true;

    try {
      module.isLoading = true;
      module.load(modulePath);
      hasThrown = false;
    } finally {
      module.isLoading = false;
      if (hasThrown) {
        delete Module._cache[modulePath];
      }
    }

    return module.exports;
  };

  type IssuerSpec = {
    apiPath: PortablePath | null;
    path: NativePath | null;
    module: NodeModule | null | undefined;
  };

  function getIssuerSpecsFromPaths(paths: Array<NativePath>): Array<IssuerSpec> {
    return paths.map(path => ({
      apiPath: opts.manager.findApiPathFor(path),
      path,
      module: null,
    }));
  }

  function getIssuerSpecsFromModule(module: NodeModule | null | undefined): Array<IssuerSpec> {
    if (module && module.id !== `<repl>` && module.id !== `internal/preload` && !module.parent && !module.filename && module.paths.length > 0) {
      return [{
        apiPath: opts.manager.findApiPathFor(module.paths[0]),
        path: module.paths[0],
        module,
      }];
    }

    const issuer = getIssuerModule(module);

    if (issuer !== null) {
      const path = npath.dirname(issuer.filename);
      const apiPath = opts.manager.getApiPathFromParent(issuer);

      return [{apiPath, path, module}];
    } else {
      const path = process.cwd();

      const apiPath =
        opts.manager.findApiPathFor(npath.join(path, `[file]`)) ??
        opts.manager.getApiPathFromParent(null);

      return [{apiPath, path, module}];
    }
  }

  function makeFakeParent(path: string) {
    const fakeParent = new Module(``);

    const fakeFilePath = npath.join(path, `[file]`);
    fakeParent.paths = Module._nodeModulePaths(fakeFilePath);

    return fakeParent;
  }

  // Splits a require request into its components, or return null if the request is a file path
  const pathRegExp = /^(?![a-zA-Z]:[\\/]|\\\\|\.{0,2}(?:\/|$))((?:@[^/]+\/)?[^/]+)\/*(.*|)$/;

  const originalModuleResolveFilename = Module._resolveFilename;

  Module._resolveFilename = function(request: string, parent: (NodeModule & {pnpApiPath?: PortablePath}) | null | undefined, isMain: boolean, options?: {[key: string]: any}) {
    if (nodeUtils.isBuiltinModule(request))
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
          `Some options passed to require() aren't supported by PnP yet (${Array.from(optionNames).join(`, `)})`,
        );
      }
    }

    const issuerSpecs = options && options.paths
      ? getIssuerSpecsFromPaths(options.paths)
      : getIssuerSpecsFromModule(parent);

    if (request.match(pathRegExp) === null) {
      const parentDirectory = parent?.filename != null
        ? npath.dirname(parent.filename)
        : null;

      const absoluteRequest = npath.isAbsolute(request)
        ? request
        : parentDirectory !== null
          ? npath.resolve(parentDirectory, request)
          : null;

      if (absoluteRequest !== null) {
        const apiPath = parentDirectory === npath.dirname(absoluteRequest) && parent?.pnpApiPath
          ? parent.pnpApiPath
          : opts.manager.findApiPathFor(absoluteRequest);

        if (apiPath !== null) {
          issuerSpecs.unshift({
            apiPath,
            path: parentDirectory,
            module: null,
          });
        }
      }
    }

    let firstError;

    for (const {apiPath, path, module} of issuerSpecs) {
      let resolution;

      const issuerApi = apiPath !== null
        ? opts.manager.getApiEntry(apiPath, true).instance
        : null;

      try {
        if (issuerApi !== null) {
          resolution = issuerApi.resolveRequest(request, path !== null ? `${path}/` : null);
        } else {
          if (path === null)
            throw new Error(`Assertion failed: Expected the path to be set`);

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

    Object.defineProperty(firstError, `requireStack`, {
      configurable: true,
      writable: true,
      enumerable: false,
      value: requireStack,
    });

    if (requireStack.length > 0)
      firstError.message += `\nRequire stack:\n- ${requireStack.join(`\n- `)}`;

    if (typeof firstError.pnpCode === `string`)
      Error.captureStackTrace(firstError);

    throw firstError;
  };

  const originalFindPath = Module._findPath;

  Module._findPath = function(request: string, paths: Array<string> | null | undefined, isMain: boolean) {
    if (request === `pnpapi`)
      return false;

    if (!enableNativeHooks)
      return originalFindPath.call(Module, request, paths, isMain);

    // https://github.com/nodejs/node/blob/e817ba70f56c4bfd5d4a68dce8b165142312e7b6/lib/internal/modules/cjs/loader.js#L490-L494
    const isAbsolute = npath.isAbsolute(request);
    if (isAbsolute)
      paths = [``];
    else if (!paths || paths.length === 0)
      return false;

    for (const path of paths) {
      let resolution: string | false;

      try {
        const pnpApiPath = opts.manager.findApiPathFor(isAbsolute ? request : path);
        if (pnpApiPath !== null) {
          const api = opts.manager.getApiEntry(pnpApiPath, true).instance;
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

  // https://github.com/nodejs/node/blob/3743406b0a44e13de491c8590386a964dbe327bb/lib/internal/modules/cjs/loader.js#L1110-L1154
  const originalExtensionJSFunction = Module._extensions[`.js`] as (module: Module, filename: string) => void;
  Module._extensions[`.js`] = function (module: Module, filename: string) {
    if (filename.endsWith(`.js`)) {
      const pkg = nodeUtils.readPackageScope(filename);
      if (pkg && pkg.data?.type === `module`) {
        const err = nodeUtils.ERR_REQUIRE_ESM(filename, module.parent?.filename);
        Error.captureStackTrace(err);
        throw err;
      }
    }

    originalExtensionJSFunction.call(this, module, filename);
  };

  // When using the ESM loader Node.js prints the following warning
  //
  // (node:14632) ExperimentalWarning: --experimental-loader is an experimental feature. This feature could change at any time
  // (Use `node --trace-warnings ...` to show where the warning was created)
  //
  // Having this warning show up once is "fine" but it's also printed
  // for each Worker that is created so it ends up spamming stderr.
  // Since that doesn't provide any value we suppress the warning.
  const originalEmitWarning = process.emitWarning;
  process.emitWarning = function (warning: string | Error, name?: string | undefined, ctor?: Function | undefined) {
    if (name === `ExperimentalWarning` && typeof warning === `string` && warning.includes(`--experimental-loader`))
      return;

    originalEmitWarning.apply(process, arguments as any);
  };

  patchFs(fs, new PosixFS(opts.fakeFs));
}
