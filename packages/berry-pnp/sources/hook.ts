type TopLevelLocator = {name: null, reference: null};
type BlacklistedLocator = {name: '\u{0000}', reference: '\u{0000}'};

type PackageLocator = {name: string, reference: string} | TopLevelLocator | BlacklistedLocator;
type PackageInformation = {packageLocation?: string, packageDependencies: Map<string, string>};

type ResolveToUnqualifiedOptions = {considerBuiltins: boolean};
type ResolveUnqualifiedOptions = {extensions: Array<string>};

interface ModuleInterface {
  id: string;
  filename: string | null;
  parent: ModuleInterface | null;
  paths: Array<string>;
  exports: any;

  load(p: string): void;
}

declare var __non_webpack_module__: ModuleInterface;

interface ModuleInterfaceStatic {
  _cache: {[p: string]: ModuleInterface};
  _extensions: {[ext: string]: any};

  _findPath(request: string, paths: Array<string>, isMain: boolean): string | false;
  _nodeModulePaths(from: string): Array<string>;
  _resolveFilename(request: string, parent: ModuleInterface | null, isMain: boolean, options?: Object): string;
  _load(request: string, parent: ModuleInterface | null, isMain: boolean): any;

  new(p: string, parent: ModuleInterface | null): ModuleInterface;
}

import {NodeFS, ZipOpenFS, patchFs} from '@berry/zipfs';
import fs                           from 'fs';
import NativeModule                 from 'module';
import path                         from 'path';
import StringDecoder                from 'string_decoder';

// @ts-ignore
const Module: ModuleInterfaceStatic = NativeModule;

const pnpFile = path.resolve(__dirname, __filename);
// @ts-ignore
const builtinModules = new Set(Module.builtinModules || Object.keys(process.binding('natives')));

// Splits a require request into its components, or return null if the request is a file path
const pathRegExp = /^(?!\.{0,2}(?:\/|$))((?:@[^\/]+\/)?[^\/]+)\/?(.*|)$/;

// Matches if the path starts with a valid path qualifier (./, ../, /)
// eslint-disable-next-line no-unused-vars
const isStrictRegExp = /^\.{0,2}\//;

// Matches if the path must point to a directory (ie ends with /)
const isDirRegExp = /\/$/;

// We only instantiate one of those so that we can use strict-equal comparisons
const topLevelLocator = {name: null, reference: null};
const blacklistedLocator = {name: `\u{0000}`, reference: `\u{0000}`};

/**
 * The setup code will be injected here. The tables listed below are guaranteed to be filled after the call to
 * the $$DYNAMICALLY_GENERATED_CODE function.
 */

// Used to detect whether a path should use the fallback even if within the dependency tree
let ignorePattern: RegExp | null;

// All the package informations will be stored there; key1 = package name, key2 = package reference
let packageInformationStores: Map<string | null, Map<string | null, PackageInformation>>;

// We store here the package locators that "own" specific locations on the disk
let packageLocatorByLocationMap: Map<string, PackageLocator>;

// We store a sorted arrays of the possible lengths that we need to check
let packageLocationLengths: Array<number>;

declare const $$DYNAMICALLY_GENERATED_CODE: (
  topLevelLocator: PackageLocator,
  blacklistedLocator: PackageLocator
) => any;

({
  ignorePattern,
  packageInformationStores,
  packageLocatorByLocationMap,
  packageLocationLengths,
} = $$DYNAMICALLY_GENERATED_CODE(
  topLevelLocator,
  blacklistedLocator,
));

/**
 * Used to disable the resolution hooks (for when we want to fallback to the previous resolution - we then need
 * a way to "reset" the environment temporarily)
 */

let enableNativeHooks = true;

/**
 * Simple helper function that assign an error code to an error, so that it can more easily be caught and used
 * by third-parties.
 */

function makeError(code: string, message: string, data: Object = {}): Error {
  const error = new Error(message);
  return Object.assign(error, {code, data});
}

/**
 * Returns the module that should be used to resolve require calls. It's usually the direct parent, except if we're
 * inside an eval expression.
 */

function getIssuerModule(parent: ModuleInterface | null): ModuleInterface | null {
  let issuer = parent;

  while (issuer && (issuer.id === '[eval]' || issuer.id === '<repl>' || !issuer.filename)) {
    issuer = issuer.parent;
  }

  return issuer;
}

/**
 * Returns information about a package in a safe way (will throw if they cannot be retrieved)
 */

function getPackageInformationSafe(packageLocator: PackageLocator): PackageInformation {
  const packageInformation = getPackageInformation(packageLocator);

  if (!packageInformation) {
    throw makeError(
      `INTERNAL`,
      `Couldn't find a matching entry in the dependency tree for the specified parent (this is probably an internal error)`,
    );
  }

  return packageInformation;
}

/**
 * Implements the node resolution for folder access and extension selection
 */

function applyNodeExtensionResolution(unqualifiedPath: string, {extensions}: ResolveUnqualifiedOptions): string | null {
  // We use this "infinite while" so that we can restart the process as long as we hit package folders
  while (true) {
    let stat;

    try {
      stat = fs.statSync(unqualifiedPath);
    } catch (error) {}

    // If the file exists and is a file, we can stop right there

    if (stat && !stat.isDirectory()) {
      // If the very last component of the resolved path is a symlink to a file, we then resolve it to a file. We only
      // do this first the last component, and not the rest of the path! This allows us to support the case of bin
      // symlinks, where a symlink in "/xyz/pkg-name/.bin/bin-name" will point somewhere else (like "/xyz/pkg-name/index.js").
      // In such a case, we want relative requires to be resolved relative to "/xyz/pkg-name/" rather than "/xyz/pkg-name/.bin/".
      //
      // Also note that the reason we must use readlink on the last component (instead of realpath on the whole path)
      // is that we must preserve the other symlinks, in particular those used by pnp to deambiguate packages using
      // peer dependencies. For example, "/xyz/.pnp/local/pnp-01234569/.bin/bin-name" should see its relative requires
      // be resolved relative to "/xyz/.pnp/local/pnp-0123456789/" rather than "/xyz/pkg-with-peers/", because otherwise
      // we would lose the information that would tell us what are the dependencies of pkg-with-peers relative to its
      // ancestors.

      if (fs.lstatSync(unqualifiedPath).isSymbolicLink()) {
        unqualifiedPath = path.normalize(path.resolve(path.dirname(unqualifiedPath), fs.readlinkSync(unqualifiedPath)));
      }

      return unqualifiedPath;
    }

    // If the file is a directory, we must check if it contains a package.json with a "main" entry

    if (stat && stat.isDirectory()) {
      let pkgJson;

      try {
        pkgJson = JSON.parse(fs.readFileSync(`${unqualifiedPath}/package.json`, 'utf-8'));
      } catch (error) {}

      let nextUnqualifiedPath;

      if (pkgJson && pkgJson.main) {
        nextUnqualifiedPath = path.resolve(unqualifiedPath, pkgJson.main);
      }

      // If the "main" field changed the path, we start again from this new location

      if (nextUnqualifiedPath && nextUnqualifiedPath !== unqualifiedPath) {
        unqualifiedPath = nextUnqualifiedPath;
        continue;
      }
    }

    // Otherwise we check if we find a file that match one of the supported extensions

    const qualifiedPath = extensions
      .map(extension => {
        return `${unqualifiedPath}${extension}`;
      })
      .find(candidateFile => {
        return fs.existsSync(candidateFile);
      });

    if (qualifiedPath) {
      return qualifiedPath;
    }

    // Otherwise, we check if the path is a folder - in such a case, we try to use its index

    if (stat && stat.isDirectory()) {
      const indexPath = extensions
        .map(extension => {
          return `${unqualifiedPath}/index${extension}`;
        })
        .find(candidateFile => {
          return fs.existsSync(candidateFile);
        });

      if (indexPath) {
        return indexPath;
      }
    }

    // Otherwise there's nothing else we can do :(

    return null;
  }
}

/**
 * This function creates fake modules that can be used with the _resolveFilename function.
 * Ideally it would be nice to be able to avoid this, since it causes useless allocations
 * and cannot be cached efficiently (we recompute the nodeModulePaths every time).
 *
 * Fortunately, this should only affect the fallback, and there hopefully shouldn't have a
 * lot of them.
 */

function makeFakeModule(path: string): ModuleInterface {
  const fakeModule = new Module(path, null);
  fakeModule.filename = path;
  fakeModule.paths = Module._nodeModulePaths(path);
  return fakeModule;
}

/**
 * Forward the resolution to the next resolver (usually the native one)
 */

function callNativeResolution(request: string, issuer: string): string | false {
  if (issuer.endsWith('/')) {
    issuer += 'internal.js';
  }

  try {
    enableNativeHooks = false;

    // Since we would need to create a fake module anyway (to call _resolveLookupPath that
    // would give us the paths to give to _resolveFilename), we can as well not use
    // the {paths} option at all, since it internally makes _resolveFilename create another
    // fake module anyway.
    return Module._resolveFilename(request, makeFakeModule(issuer), false);
  } finally {
    enableNativeHooks = true;
  }
}

/**
 * This key indicates which version of the standard is implemented by this resolver. The `std` key is the
 * Plug'n'Play standard, and any other key are third-party extensions. Third-party extensions are not allowed
 * to override the standard, and can only offer new methods.
 *
 * If an new version of the Plug'n'Play standard is released and some extensions conflict with newly added
 * functions, they'll just have to fix the conflicts and bump their own version number.
 */

export const VERSIONS = {std: 1};

export const topLevel = topLevelLocator;

/**
 * Gets the package information for a given locator. Returns null if they cannot be retrieved.
 */

export function getPackageInformation({name, reference}: PackageLocator): PackageInformation | null {
  const packageInformationStore = packageInformationStores.get(name);

  if (!packageInformationStore) {
    return null;
  }

  const packageInformation = packageInformationStore.get(reference);

  if (!packageInformation) {
    return null;
  }

  return packageInformation;
};

/**
 * Finds the package locator that owns the specified path. If none is found, returns null instead.
 */

export function findPackageLocator(location: string): PackageLocator | null {
  let relativeLocation = path.relative(__dirname, location);

  if (!relativeLocation.match(isStrictRegExp)) {
    relativeLocation = `./${relativeLocation}`;
  }

  if (location.match(isDirRegExp) && relativeLocation.charAt(relativeLocation.length - 1) !== '/') {
    relativeLocation = `${relativeLocation}/`;
  }

  let from = 0;

  // If someone wants to use a binary search to go from O(n) to O(log n), be my guest
  while (from < packageLocationLengths.length && packageLocationLengths[from] > relativeLocation.length)
    from += 1;

  for (let t = from; t < packageLocationLengths.length; ++t) {
    const locator = packageLocatorByLocationMap.get(relativeLocation.substr(0, packageLocationLengths[t]));

    if (!locator) {
      continue;
    }

    // Ensures that the returned locator isn't a blacklisted one.
    //
    // Blacklisted packages are packages that cannot be used because their dependencies cannot be deduced. This only
    // happens with peer dependencies, which effectively have different sets of dependencies depending on their
    // parents.
    //
    // In order to deambiguate those different sets of dependencies, the Yarn implementation of PnP will generate a
    // symlink for each combination of <package name>/<package version>/<dependent package> it will find, and will
    // blacklist the target of those symlinks. By doing this, we ensure that files loaded through a specific path
    // will always have the same set of dependencies, provided the symlinks are correctly preserved.
    //
    // Unfortunately, some tools do not preserve them, and when it happens PnP isn't able anymore to deduce the set of
    // dependencies based on the path of the file that makes the require calls. But since we've blacklisted those
    // paths, we're able to print a more helpful error message that points out that a third-party package is doing
    // something incompatible!

    if (locator === blacklistedLocator) {
      throw makeError(
       `BLACKLISTED`,
        [
          `A package has been resolved through a blacklisted path - this is usually caused by one of your tool`,
          `calling "realpath" on the return value of "require.resolve". Since the returned values use symlinks to`,
          `disambiguate peer dependencies, they must be passed untransformed to "require".`,
        ].join(` `),
      );
    }

    return locator;
  }

  return null;
}

/**
 * Transforms a request (what's typically passed as argument to the require function) into an unqualified path.
 * This path is called "unqualified" because it only changes the package name to the package location on the disk,
 * which means that the end result still cannot be directly accessed (for example, it doesn't try to resolve the
 * file extension, or to resolve directories to their "index.js" content). Use the "resolveUnqualified" function
 * to convert them to fully-qualified paths, or just use "resolveRequest" that do both operations in one go.
 *
 * Note that it is extremely important that the `issuer` path ends with a forward slash if the issuer is to be
 * treated as a folder (ie. "/tmp/foo/" rather than "/tmp/foo" if "foo" is a directory). Otherwise relative
 * imports won't be computed correctly (they'll get resolved relative to "/tmp/" instead of "/tmp/foo/").
 */

export function resolveToUnqualified(request: string, issuer: string | null, {considerBuiltins = true}: Partial<ResolveToUnqualifiedOptions> = {}): string | null {
  // The 'pnpapi' request is reserved and will always return the path to the PnP file, from everywhere

  if (request === `pnpapi`) {
    return pnpFile;
  }

  // Bailout if the request is a native module

  if (considerBuiltins && builtinModules.has(request)) {
    return null;
  }

  // We allow disabling the pnp resolution for some subpaths. This is because some projects, often legacy,
  // contain multiple levels of dependencies (ie. a yarn.lock inside a subfolder of a yarn.lock). This is
  // typically solved using workspaces, but not all of them have been converted already.

  if (ignorePattern && issuer && ignorePattern.test(issuer)) {
    const result = callNativeResolution(request, issuer);

    if (result === false) {
      throw makeError(
        `BUILTIN_NODE_RESOLUTION_FAIL`,
        `The builtin node resolution algorithm was unable to resolve the module referenced by "${request}" and requested from "${issuer}" (it didn't go through the pnp resolver because the issuer was explicitely ignored by the regexp "$$BLACKLIST")`,
        {
          request,
          issuer,
        },
      );
    }

    return result;
  }

  let unqualifiedPath;

  // If the request is a relative or absolute path, we just return it normalized

  const dependencyNameMatch = request.match(pathRegExp);

  if (!dependencyNameMatch) {
    if (path.isAbsolute(request)) {
      unqualifiedPath = path.normalize(request);
    } else {
      if (!issuer) {
        throw makeError(
          `API_ERROR`,
          `The resolveToUnqualified function must be called with a valid issuer when the path isn't a builtin nor absolute`,
          {
            request,
            issuer,
          }
        );
      }

      if (issuer.match(isDirRegExp)) {
        unqualifiedPath = path.normalize(path.resolve(issuer, request));
      } else {
        unqualifiedPath = path.normalize(path.resolve(path.dirname(issuer), request));
      }
    }
  }

  // Things are more hairy if it's a package require - we then need to figure out which package is needed, and in
  // particular the exact version for the given location on the dependency tree

  else {
    if (!issuer) {
      throw makeError(
        `API_ERROR`,
        `The resolveToUnqualified function must be called with a valid issuer when the path isn't a builtin nor absolute`,
        {
          request,
          issuer,
        }
      );
    }

    const [, dependencyName, subPath] = dependencyNameMatch;

    const issuerLocator = findPackageLocator(issuer);

    // If the issuer file doesn't seem to be owned by a package managed through pnp, then we resort to using the next
    // resolution algorithm in the chain, usually the native Node resolution one

    if (!issuerLocator) {
      const result = callNativeResolution(request, issuer);

      if (result === false) {
        throw makeError(
          `BUILTIN_NODE_RESOLUTION_FAIL`,
          `The builtin node resolution algorithm was unable to resolve the module referenced by "${request}" and requested from "${issuer}" (it didn't go through the pnp resolver because the issuer doesn't seem to be part of the Yarn-managed dependency tree)`,
          {
            request,
            issuer,
          },
        );
      }

      return result;
    }

    const issuerInformation = getPackageInformationSafe(issuerLocator);

    // We obtain the dependency reference in regard to the package that request it

    let dependencyReference = issuerInformation.packageDependencies.get(dependencyName);

    // If we can't find it, we check if we can potentially load it from the top-level packages
    // it's a bit of a hack, but it improves compatibility with the existing Node ecosystem. Hopefully we should
    // eventually be able to kill it and become stricter once pnp gets enough traction

    if (dependencyReference === undefined) {
      const topLevelInformation = getPackageInformationSafe(topLevelLocator);
      dependencyReference = topLevelInformation.packageDependencies.get(dependencyName);
    }

    // If we can't find the path, and if the package making the request is the top-level, we can offer nicer error messages

    if (!dependencyReference) {
      if (dependencyReference === null) {
        if (issuerLocator === topLevelLocator) {
          throw makeError(
            `MISSING_PEER_DEPENDENCY`,
            `You seem to be requiring a peer dependency ("${dependencyName}"), but it is not installed (which might be because you're the top-level package)`,
            {request, issuer, dependencyName},
          );
        } else {
          throw makeError(
            `MISSING_PEER_DEPENDENCY`,
            `Package "${issuerLocator.name}@${issuerLocator.reference}" is trying to access a peer dependency ("${dependencyName}") that should be provided by its direct ancestor but isn't`,
            {request, issuer, issuerLocator: Object.assign({}, issuerLocator), dependencyName},
          );
        }
      } else {
        if (issuerLocator === topLevelLocator) {
          throw makeError(
            `UNDECLARED_DEPENDENCY`,
            `You cannot require a package ("${dependencyName}") that is not declared in your dependencies (via "${issuer}")`,
            {request, issuer, dependencyName},
          );
        } else {
          const candidates = Array.from(issuerInformation.packageDependencies.keys());
          throw makeError(
            `UNDECLARED_DEPENDENCY`,
            `Package "${issuerLocator.name}@${issuerLocator.reference}" (via "${issuer}") is trying to require the package "${dependencyName}" (via "${request}") without it being listed in its dependencies (${candidates.join(
              `, `,
            )})`,
            {request, issuer, issuerLocator: Object.assign({}, issuerLocator), dependencyName, candidates},
          );
        }
      }
    }

    // We need to check that the package exists on the filesystem, because it might not have been installed

    const dependencyLocator = {name: dependencyName, reference: dependencyReference};
    const dependencyInformation = getPackageInformationSafe(dependencyLocator);

    if (!dependencyInformation.packageLocation) {
      throw makeError(
        `MISSING_DEPENDENCY`,
        `Package "${dependencyLocator.name}@${dependencyLocator.reference}" is a valid dependency, but hasn't been installed and thus cannot be required (it might be caused if you install a partial tree, such as on production environments)`,
        {request, issuer, dependencyLocator: Object.assign({}, dependencyLocator)},
      );
    }

    // Now that we know which package we should resolve to, we only have to find out the file location

    const dependencyLocation = path.resolve(__dirname, dependencyInformation.packageLocation);

    if (subPath) {
      unqualifiedPath = path.resolve(dependencyLocation, subPath);
    } else {
      unqualifiedPath = dependencyLocation;
    }
  }

  return path.normalize(unqualifiedPath);
};

/**
 * Transforms an unqualified path into a qualified path by using the Node resolution algorithm (which automatically
 * appends ".js" / ".json", and transforms directory accesses into "index.js").
 */

export function resolveUnqualified(
  unqualifiedPath: string,
  {extensions = Object.keys(Module._extensions)}: Partial<ResolveUnqualifiedOptions> = {},
): string {
  const qualifiedPath = applyNodeExtensionResolution(unqualifiedPath, {extensions});

  if (qualifiedPath) {
    return path.normalize(qualifiedPath);
  } else {
    throw makeError(
      `QUALIFIED_PATH_RESOLUTION_FAILED`,
      `Couldn't find a suitable Node resolution for unqualified path "${unqualifiedPath}"`,
      {unqualifiedPath},
    );
  }
};

/**
 * Transforms a request into a fully qualified path.
 *
 * Note that it is extremely important that the `issuer` path ends with a forward slash if the issuer is to be
 * treated as a folder (ie. "/tmp/foo/" rather than "/tmp/foo" if "foo" is a directory). Otherwise relative
 * imports won't be computed correctly (they'll get resolved relative to "/tmp/" instead of "/tmp/foo/").
 */

export function resolveRequest(request: string, issuer: string | null, {considerBuiltins, extensions}: Partial<ResolveToUnqualifiedOptions & ResolveUnqualifiedOptions> = {}): string | null {
  let unqualifiedPath = resolveToUnqualified(request, issuer, {considerBuiltins});

  if (unqualifiedPath === null) {
    return null;
  }

  try {
    return resolveUnqualified(unqualifiedPath, {extensions});
  } catch (resolutionError) {
    if (resolutionError.code === 'QUALIFIED_PATH_RESOLUTION_FAILED') {
      Object.assign(resolutionError.data, {request, issuer});
    }
    throw resolutionError;
  }
};

/**
 * Setups the hook into the Node environment.
 *
 * From this point on, any call to `require()` will go through the "resolveRequest" function, and the result will
 * be used as path of the file to load.
 */

export function setup() {
  // @ts-ignore
  process.versions.pnp = String(VERSIONS.std);

  // A small note: we don't replace the cache here (and instead use the native one). This is an effort to not
  // break code similar to "delete require.cache[require.resolve(FOO)]", where FOO is a package located outside
  // of the Yarn dependency tree. In this case, we defer the load to the native loader. If we were to replace the
  // cache by our own, the native loader would populate its own cache, which wouldn't be exposed anymore, so the
  // delete call would be broken.

  const originalModuleLoad = Module._load;

  Module._load = function(request: string, parent: ModuleInterface, isMain: boolean) {
    if (!enableNativeHooks) {
      return originalModuleLoad.call(Module, request, parent, isMain);
    }

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

    if (request === `pnpapi`) {
      return __non_webpack_module__.exports;
    }

    // Request `Module._resolveFilename` (ie. `resolveRequest`) to tell us which file we should load

    const modulePath = Module._resolveFilename(request, parent, isMain);

    // Check if the module has already been created for the given file

    const cacheEntry = Module._cache[modulePath];

    if (cacheEntry) {
      return cacheEntry.exports;
    }

    // Create a new module and store it into the cache

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

    return module.exports;
  };

  const originalModuleResolveFilename = Module._resolveFilename;

  Module._resolveFilename = function(request: string, parent: ModuleInterface | null, isMain: boolean, options: Object) {
    if (request === `pnpapi`) {
      return request;
    }

    if (!enableNativeHooks) {
      return originalModuleResolveFilename.call(Module, request, parent, isMain, options);
    }

    const issuerModule = getIssuerModule(parent);
    const issuer = issuerModule ? issuerModule.filename : process.cwd() + '/';

    const resolution = resolveRequest(request, issuer);
    return resolution !== null ? resolution : request;
  };

  const originalFindPath = Module._findPath;

  Module._findPath = function(request: string, paths: Array<string>, isMain: boolean) {
    if (request === `pnpapi`) {
      return false;
    }

    if (!enableNativeHooks) {
      return originalFindPath.call(Module, request, paths, isMain);
    }

    for (const path of paths) {
      let resolution;

      try {
        resolution = resolveRequest(request, path);
      } catch (error) {
        continue;
      }

      if (resolution) {
        return resolution;
      }
    }

    return false;
  };

  // We must copy the fs into a local, because otherwise
  // 1. we would make the NodeFS instance use the function that we patched (infinite loop)
  // 2. Object.create(fs) isn't enough, since it won't prevent the proto from being modified
  const localFs: typeof fs = {...fs};
  const nodeFs = new NodeFS(localFs);

  patchFs(fs, new ZipOpenFS({baseFs: nodeFs, filter: /\.zip\//}));
};

if (__non_webpack_module__.parent && __non_webpack_module__.parent.id === 'internal/preload') {
  setup();
}

// @ts-ignore
if (process.mainModule === __non_webpack_module__) {
  const reportError = (code: string, message: string, data: Object) => {
    process.stdout.write(`${JSON.stringify([{code, message, data}, null])}\n`);
  };

  const reportSuccess = (resolution: string | null) => {
    process.stdout.write(`${JSON.stringify([null, resolution])}\n`);
  };

  const processResolution = (request: string, issuer: string) => {
    try {
      reportSuccess(resolveRequest(request, issuer));
    } catch (error) {
      reportError(error.code, error.message, error.data);
    }
  };

  const processRequest = (data: string) => {
    try {
      const [request, issuer] = JSON.parse(data);
      processResolution(request, issuer);
    } catch (error) {
      reportError(`INVALID_JSON`, error.message, error.data);
    }
  };

  if (process.argv.length > 2) {
    if (process.argv.length !== 4) {
      process.stderr.write(`Usage: ${process.argv[0]} ${process.argv[1]} <request> <issuer>\n`);
      process.exitCode = 64; /* EX_USAGE */
    } else {
      processResolution(process.argv[2], process.argv[3]);
    }
  } else {
    let buffer = '';
    const decoder = new StringDecoder.StringDecoder();

    process.stdin.on('data', chunk => {
      buffer += decoder.write(chunk);

      do {
        const index = buffer.indexOf('\n');
        if (index === -1) {
          break;
        }

        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 1);

        processRequest(line);
      } while (true);
    });
  }
}
