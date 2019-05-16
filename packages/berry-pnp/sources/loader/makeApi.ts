import {FakeFS, NodeFS, PortablePath, NativePath, Path}           from '@berry/fslib';
import {ppath, toFilename}                                        from '@berry/fslib';
import Module                                                     from 'module';

import {PackageInformation, PackageLocator, PnpApi, RuntimeState} from '../types';

import {makeError}                                                from './internalTools';

export type MakeApiOptions = {
  allowDebug?: boolean,
  compatibilityMode?: boolean,
  fakeFs: FakeFS<PortablePath>,
  pnpapiResolution: NativePath,
};

export type ResolveToUnqualifiedOptions = {
  considerBuiltins?: boolean,
};

export type ResolveUnqualifiedOptions = {
  extensions?: Array<string>,
};

export type ResolveRequestOptions =
  ResolveToUnqualifiedOptions &
  ResolveUnqualifiedOptions;

export function makeApi(runtimeState: RuntimeState, opts: MakeApiOptions): PnpApi {
  // @ts-ignore
  const builtinModules = new Set(Module.builtinModules || Object.keys(process.binding('natives')));

  // Splits a require request into its components, or return null if the request is a file path
  const pathRegExp = /^(?![a-zA-Z]:[\\\/]|\\\\|\.{0,2}(?:\/|$))((?:@[^\/]+\/)?[^\/]+)\/?(.*|)$/;

  // Matches if the path starts with a valid path qualifier (./, ../, /)
  // eslint-disable-next-line no-unused-vars
  const isStrictRegExp = /^\.{0,2}\//;

  // Matches if the path must point to a directory (ie ends with /)
  const isDirRegExp = /\/$/;

  // Matches backslashes of Windows paths
  const backwardSlashRegExp = /\\/g;

  // We only instantiate one of those so that we can use strict-equal comparisons
  const topLevelLocator = {name: null, reference: null};

  // Used for compatibility purposes - cf setupCompatibilityLayer
  const fallbackLocators: Array<PackageLocator> = [];

  if (runtimeState.enableTopLevelFallback === true)
    fallbackLocators.push(topLevelLocator);

  if (opts.compatibilityMode) {
    // ESLint currently doesn't have any portable way for shared configs to
    // specify their own plugins that should be used (cf issue #10125). This
    // will likely get fixed at some point but it'll take time, so in the
    // meantime we'll just add additional fallback entries for common shared
    // configs.

    // Similarly, Gatsby generates files within the `public` folder located
    // within the project, but doesn't pre-resolve the `require` calls to use
    // its own dependencies. Meaning that when PnP see a file from the `public`
    // folder making a require, it thinks that your project forgot to list one
    // of your dependencies.

    for (const name of [`react-scripts`, `gatsby`]) {
      const packageStore = runtimeState.packageRegistry.get(name);
      if (packageStore) {
        for (const reference of packageStore.keys()) {
          if (reference === null) {
            throw new Error(`Assertion failed: This reference shouldn't be null`);
          } else {
            fallbackLocators.push({name, reference});
          }
        }
      }
    }
  }

  /**
   * The setup code will be injected here. The tables listed below are guaranteed to be filled after the call to
   * the $$DYNAMICALLY_GENERATED_CODE function.
   */

  const {
    ignorePattern,
    packageRegistry,
    packageLocatorsByLocations,
    packageLocationLengths,
  } = runtimeState as RuntimeState;

  /**
   * Allows to print useful logs just be setting a value in the environment
   */

  function makeLogEntry(name: string, args: Array<any>) {
    return {
      fn: name,
      args: args,
      error: null as Error | null,
      result: null as any,
    };
  }

  function maybeLog(name: string, fn: any): any {
    if (opts.allowDebug === false)
      return fn;

    const level = Number(process.env.PNP_DEBUG_LEVEL);

    if (Number.isFinite(level)) {
      if (level >= 2) {

        return (... args: Array<any>) => {
          const logEntry = makeLogEntry(name, args);

          try {
            return logEntry.result = fn(... args);
          } catch (error) {
            throw logEntry.error = error;
          } finally {
            console.error(logEntry);
          }
        };

      } else if (level >= 1) {

        return (... args: Array<any>) => {
          try {
            return fn(... args);
          } catch (error) {
            const logEntry = makeLogEntry(name, args);
            logEntry.error = error;
            console.error(logEntry);
            throw error;
          }
        };

      }
    }

    return fn;
  }

  /**
   * Returns information about a package in a safe way (will throw if they cannot be retrieved)
   */

  function getPackageInformationSafe(packageLocator: PackageLocator): PackageInformation<PortablePath> {
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

  function applyNodeExtensionResolution(unqualifiedPath: PortablePath, candidates: Array<PortablePath>, {extensions}: {extensions: Array<string>}): PortablePath | null {
    // We use this "infinite while" so that we can restart the process as long as we hit package folders
    while (true) {
      let stat;

      try {
        candidates.push(unqualifiedPath);
        stat = opts.fakeFs.statSync(unqualifiedPath);
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

        if (opts.fakeFs.lstatSync(unqualifiedPath).isSymbolicLink())
          unqualifiedPath = ppath.normalize(ppath.resolve(ppath.dirname(unqualifiedPath), opts.fakeFs.readlinkSync(unqualifiedPath)));

        return unqualifiedPath;
      }

      // If the file is a directory, we must check if it contains a package.json with a "main" entry

      if (stat && stat.isDirectory()) {
        let pkgJson;

        try {
          pkgJson = JSON.parse(opts.fakeFs.readFileSync(ppath.join(unqualifiedPath, toFilename(`package.json`)), `utf8`));
        } catch (error) {}

        let nextUnqualifiedPath;

        if (pkgJson && pkgJson.main)
          nextUnqualifiedPath = ppath.resolve(unqualifiedPath, pkgJson.main);

        // If the "main" field changed the path, we start again from this new location

        if (nextUnqualifiedPath && nextUnqualifiedPath !== unqualifiedPath) {
          const resolution = applyNodeExtensionResolution(nextUnqualifiedPath, candidates, {extensions});

          if (resolution !== null) {
            return resolution;
          }
        }
      }

      // Otherwise we check if we find a file that match one of the supported extensions

      const qualifiedPath = extensions
        .map(extension => {
          return `${unqualifiedPath}${extension}` as PortablePath;
        })
        .find(candidateFile => {
          candidates.push(candidateFile);
          return opts.fakeFs.existsSync(candidateFile);
        });

      if (qualifiedPath)
        return qualifiedPath;

      // Otherwise, we check if the path is a folder - in such a case, we try to use its index

      if (stat && stat.isDirectory()) {
        const indexPath = extensions
          .map(extension => {
            return ppath.format({dir: unqualifiedPath, name: toFilename(`index`), ext: extension});
          })
          .find(candidateFile => {
            candidates.push(candidateFile);
            return opts.fakeFs.existsSync(candidateFile);
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

  function makeFakeModule(path: NativePath): NodeModule {
    // @ts-ignore
    const fakeModule = new Module(path, null);
    fakeModule.filename = path;
    fakeModule.paths = Module._nodeModulePaths(path);
    return fakeModule;
  }

  /**
   * Normalize path to posix format.
   */

  function normalizePath(p: Path) {
    return NodeFS.toPortablePath(p);
  }

  /**
   * Forward the resolution to the next resolver (usually the native one)
   */

  function callNativeResolution(request: PortablePath, issuer: PortablePath): NativePath | false {
    if (issuer.endsWith(`/`))
      issuer = ppath.join(issuer, toFilename(`internal.js`));

    // Since we would need to create a fake module anyway (to call _resolveLookupPath that
    // would give us the paths to give to _resolveFilename), we can as well not use
    // the {paths} option at all, since it internally makes _resolveFilename create another
    // fake module anyway.
    return Module._resolveFilename(request, makeFakeModule(NodeFS.fromPortablePath(issuer)), false, {plugnplay: false});
  }

  /**
   * This key indicates which version of the standard is implemented by this resolver. The `std` key is the
   * Plug'n'Play standard, and any other key are third-party extensions. Third-party extensions are not allowed
   * to override the standard, and can only offer new methods.
   *
   * If an new version of the Plug'n'Play standard is released and some extensions conflict with newly added
   * functions, they'll just have to fix the conflicts and bump their own version number.
   */

  const VERSIONS = {std: 1};

  /**
   * We export a special symbol for easy access to the top level locator.
   */

  const topLevel = topLevelLocator;

  /**
   * Gets the package information for a given locator. Returns null if they cannot be retrieved.
   */

  function getPackageInformation({name, reference}: PackageLocator): PackageInformation<PortablePath> | null {
    const packageInformationStore = packageRegistry.get(name);

    if (!packageInformationStore)
      return null;

    const packageInformation = packageInformationStore.get(reference);

    if (!packageInformation)
      return null;

    return packageInformation;
  }

  /**
   * Finds the package locator that owns the specified path. If none is found, returns null instead.
   */

  function findPackageLocator(location: PortablePath): PackageLocator | null {
    let relativeLocation = normalizePath(ppath.relative(runtimeState.basePath, location));

    if (!relativeLocation.match(isStrictRegExp))
      relativeLocation = `./${relativeLocation}` as PortablePath;

    if (location.match(isDirRegExp) && !relativeLocation.endsWith(`/`))
      relativeLocation = `${relativeLocation}/` as PortablePath;

    let from = 0;

    // If someone wants to use a binary search to go from O(n) to O(log n), be my guest
    while (from < packageLocationLengths.length && packageLocationLengths[from] > relativeLocation.length)
      from += 1;

    for (let t = from; t < packageLocationLengths.length; ++t) {
      const locator = packageLocatorsByLocations.get(relativeLocation.substr(0, packageLocationLengths[t]) as PortablePath);
      if (!locator)
        continue;

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

      if (locator === null) {
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

  function resolveToUnqualified(request: PortablePath, issuer: PortablePath | null, {considerBuiltins = true}: ResolveToUnqualifiedOptions = {}): PortablePath | null {
    // The 'pnpapi' request is reserved and will always return the path to the PnP file, from everywhere

    if (request === `pnpapi`)
      return NodeFS.toPortablePath(opts.pnpapiResolution);

    // Bailout if the request is a native module

    if (considerBuiltins && builtinModules.has(request))
      return null;

    // We allow disabling the pnp resolution for some subpaths. This is because some projects, often legacy,
    // contain multiple levels of dependencies (ie. a yarn.lock inside a subfolder of a yarn.lock). This is
    // typically solved using workspaces, but not all of them have been converted already.

    if (ignorePattern && issuer && ignorePattern.test(normalizePath(issuer))) {
      const result = callNativeResolution(request, issuer);

      if (result === false) {
        throw makeError(
          `BUILTIN_NODE_RESOLUTION_FAIL`,
          `The builtin node resolution algorithm was unable to resolve the requested module (it didn't go through the pnp resolver because the issuer was explicitely ignored by the regexp)\n\nRequire request: "${request}"\nRequired by: ${issuer}\n`,
          {request, issuer},
        );
      }

      return NodeFS.toPortablePath(result);
    }

    let unqualifiedPath: PortablePath;

    // If the request is a relative or absolute path, we just return it normalized

    const dependencyNameMatch = request.match(pathRegExp);

    if (!dependencyNameMatch) {
      if (ppath.isAbsolute(request)) {
        unqualifiedPath = ppath.normalize(request);
      } else {
        if (!issuer) {
          throw makeError(
            `API_ERROR`,
            `The resolveToUnqualified function must be called with a valid issuer when the path isn't a builtin nor absolute`,
            {request, issuer},
          );
        }

        if (issuer.match(isDirRegExp)) {
          unqualifiedPath = ppath.normalize(ppath.resolve(issuer, request));
        } else {
          unqualifiedPath = ppath.normalize(ppath.resolve(ppath.dirname(issuer), request));
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
          {request, issuer},
        );
      }

      const [, dependencyName, subPath] = dependencyNameMatch as [unknown, string, PortablePath];

      const issuerLocator = findPackageLocator(issuer);

      // If the issuer file doesn't seem to be owned by a package managed through pnp, then we resort to using the next
      // resolution algorithm in the chain, usually the native Node resolution one

      if (!issuerLocator) {
        const result = callNativeResolution(request, issuer);

        if (result === false) {
          throw makeError(
            `BUILTIN_NODE_RESOLUTION_FAIL`,
            `The builtin node resolution algorithm was unable to resolve the requested module (it didn't go through the pnp resolver because the issuer doesn't seem to be part of the Yarn-managed dependency tree)\n\nRequire path: "${request}"\nRequired by: ${issuer}\n`,
            {request, issuer},
          );
        }

        return NodeFS.toPortablePath(result);
      }

      const issuerInformation = getPackageInformationSafe(issuerLocator);

      // We obtain the dependency reference in regard to the package that request it

      let dependencyReference = issuerInformation.packageDependencies.get(dependencyName);

      // If we can't find it, we check if we can potentially load it from the packages that have been defined as potential fallbacks.
      // It's a bit of a hack, but it improves compatibility with the existing Node ecosystem. Hopefully we should eventually be able
      // to kill this logic and become stricter once pnp gets enough traction and the affected packages fix themselves.

      if (issuerLocator.name !== null) {
        // To allow programs to become gradually stricter, starting from the v2 we enforce that workspaces cannot depend on fallbacks.
        // This works by having a list containing all their locators, and checking when a fallback is required whether it's one of them.
        const exclusionEntry = runtimeState.fallbackExclusionList.get(issuerLocator.name);
        const canUseFallbacks = !exclusionEntry || !exclusionEntry.has(issuerLocator.reference);

        if (canUseFallbacks) {
          for (let t = 0, T = fallbackLocators.length; dependencyReference === undefined && t < T; ++t) {
            const fallbackInformation = getPackageInformationSafe(fallbackLocators[t]);
            dependencyReference = fallbackInformation.packageDependencies.get(dependencyName);
          }
        }
      }

      // If we can't find the path, and if the package making the request is the top-level, we can offer nicer error messages

      if (dependencyReference === null) {
        if (issuerLocator.name === null) {
          throw makeError(
            `MISSING_PEER_DEPENDENCY`,
            `Something that got detected as your top-level application (because it doesn't seem to belong to any package) tried to access a peer dependency; this isn't allowed as the peer dependency cannot be provided by any parent package\n\nRequired package: ${dependencyName} (via "${request}")\nRequired by: ${issuer}\n`,
            {request, issuer, dependencyName},
          );
        } else {
          throw makeError(
            `MISSING_PEER_DEPENDENCY`,
            `A package is trying to access a peer dependency that should be provided by its direct ancestor but isn't\n\nRequired package: ${dependencyName} (via "${request}")\nRequired by: ${issuerLocator.name}@${issuerLocator.reference} (via ${issuer})\n`,
            {request, issuer, issuerLocator: Object.assign({}, issuerLocator), dependencyName},
          );
        }
      } else if (dependencyReference === undefined) {
        if (issuerLocator.name === null) {
          throw makeError(
            `UNDECLARED_DEPENDENCY`,
            `Something that got detected as your top-level application (because it doesn't seem to belong to any package) tried to access a package that is not declared in your dependencies\n\nRequired package: ${dependencyName} (via "${request}")\nRequired by: ${issuer}\n`,
            {request, issuer, dependencyName},
          );
        } else {
          const candidates = Array.from(issuerInformation.packageDependencies.keys());
          throw makeError(
            `UNDECLARED_DEPENDENCY`,
            `A package is trying to access another package without the second one being listed as a dependency of the first one\n\nRequired package: ${dependencyName} (via "${request}")\nRequired by: ${issuerLocator.name}@${issuerLocator.reference} (via ${issuer})\n`,
            {request, issuer, issuerLocator: Object.assign({}, issuerLocator), dependencyName, candidates},
          );
        }
      }

      // We need to check that the package exists on the filesystem, because it might not have been installed

      const dependencyLocator = Array.isArray(dependencyReference)
        ? {name: dependencyReference[0], reference: dependencyReference[1]}
        : {name: dependencyName, reference: dependencyReference};

      const dependencyInformation = getPackageInformationSafe(dependencyLocator);

      if (!dependencyInformation.packageLocation) {
        throw makeError(
          `MISSING_DEPENDENCY`,
          `A dependency seems valid but didn't get installed for some reason. This might be caused by a partial install, such as dev vs prod.\n\nRequired package: ${dependencyLocator.name}@${dependencyLocator.reference} (via "${request}")\nRequired by: ${issuerLocator.name}@${issuerLocator.reference} (via ${issuer})\n`,
          {request, issuer, dependencyLocator: Object.assign({}, dependencyLocator)},
        );
      }

      // Now that we know which package we should resolve to, we only have to find out the file location

      const dependencyLocation = ppath.resolve(runtimeState.basePath, dependencyInformation.packageLocation);

      if (subPath) {
        unqualifiedPath = ppath.resolve(dependencyLocation, subPath);
      } else {
        unqualifiedPath = dependencyLocation;
      }
    }

    return ppath.normalize(unqualifiedPath);
  };

  /**
   * Transforms an unqualified path into a qualified path by using the Node resolution algorithm (which automatically
   * appends ".js" / ".json", and transforms directory accesses into "index.js").
   */

  function resolveUnqualified(unqualifiedPath: PortablePath, {extensions = Object.keys(Module._extensions)}: ResolveUnqualifiedOptions = {}): PortablePath {
    const candidates: Array<PortablePath> = [];
    const qualifiedPath = applyNodeExtensionResolution(unqualifiedPath, candidates, {extensions});

    if (qualifiedPath) {
      return ppath.normalize(qualifiedPath);
    } else {
      throw makeError(
        `QUALIFIED_PATH_RESOLUTION_FAILED`,
        `Couldn't find a suitable Node resolution for the specified unqualified path\n\nSource path: ${unqualifiedPath}\n${candidates.map(candidate => `Rejected resolution: ${candidate}\n`).join(``)}`,
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

  function resolveRequest(request: PortablePath, issuer: PortablePath | null, {considerBuiltins, extensions}: ResolveRequestOptions = {}): PortablePath | null {
    let unqualifiedPath = resolveToUnqualified(request, issuer, {considerBuiltins});

    if (unqualifiedPath === null)
      return null;

    try {
      return resolveUnqualified(unqualifiedPath, {extensions});
    } catch (resolutionError) {
      if (resolutionError.code === 'QUALIFIED_PATH_RESOLUTION_FAILED')
        Object.assign(resolutionError.data, {request, issuer});

      throw resolutionError;
    }
  };

  return {
    VERSIONS,
    topLevel,

    getPackageInformation: (locator: PackageLocator) => {
      const info = getPackageInformation(locator);

      if (info === null)
        return null;

      const packageLocation = NodeFS.fromPortablePath(info.packageLocation);
      const nativeInfo = {... info, packageLocation};

      return nativeInfo;
    },

    findPackageLocator: (path: string) => {
      return findPackageLocator(NodeFS.toPortablePath(path));
    },

    resolveToUnqualified: maybeLog(`resolveToUnqualified`, (request: NativePath, issuer: NativePath | null, opts?: ResolveToUnqualifiedOptions) => {
      const portableIssuer = issuer !== null ?  NodeFS.toPortablePath(issuer) : null;

      const resolution = resolveToUnqualified(NodeFS.toPortablePath(request), portableIssuer, opts);
      if (resolution === null)
        return null;

      return NodeFS.fromPortablePath(resolution);
    }),

    resolveUnqualified: maybeLog(`resolveUnqualified`, (unqualifiedPath: NativePath, opts?: ResolveUnqualifiedOptions) => {
      return NodeFS.fromPortablePath(resolveUnqualified(NodeFS.toPortablePath(unqualifiedPath), opts));
    }),

    resolveRequest: maybeLog(`resolveRequest`, (request: NativePath, issuer: NativePath | null, opts?: ResolveRequestOptions) => {
      const portableIssuer = issuer !== null ? NodeFS.toPortablePath(issuer) : null;

      const resolution = resolveRequest(NodeFS.toPortablePath(request), portableIssuer, opts);
      if (resolution === null)
        return null;

      return NodeFS.fromPortablePath(resolution);
    }),
  };
}
