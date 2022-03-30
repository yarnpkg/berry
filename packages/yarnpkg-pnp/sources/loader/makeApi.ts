import {ppath, Filename}                                                                                                                                                                   from '@yarnpkg/fslib';
import {FakeFS, NativePath, PortablePath, VirtualFS, npath}                                                                                                                                from '@yarnpkg/fslib';
import {Module}                                                                                                                                                                            from 'module';
import {resolve as resolveExport}                                                                                                                                                          from 'resolve.exports';
import {inspect}                                                                                                                                                                           from 'util';

import {PackageInformation, PackageLocator, PnpApi, RuntimeState, PhysicalPackageLocator, DependencyTarget, ResolveToUnqualifiedOptions, ResolveUnqualifiedOptions, ResolveRequestOptions} from '../types';

import {ErrorCode, makeError, getPathForDisplay}                                                                                                                                           from './internalTools';
import * as nodeUtils                                                                                                                                                                      from './nodeUtils';

export type MakeApiOptions = {
  allowDebug?: boolean;
  compatibilityMode?: boolean;
  fakeFs: FakeFS<PortablePath>;
  pnpapiResolution: NativePath;
};

export function makeApi(runtimeState: RuntimeState, opts: MakeApiOptions): PnpApi {
  const alwaysWarnOnFallback = Number(process.env.PNP_ALWAYS_WARN_ON_FALLBACK) > 0;
  const debugLevel = Number(process.env.PNP_DEBUG_LEVEL);

  // Splits a require request into its components, or return null if the request is a file path
  const pathRegExp = /^(?![a-zA-Z]:[\\/]|\\\\|\.{0,2}(?:\/|$))((?:node:)?(?:@[^/]+\/)?[^/]+)\/*(.*|)$/;

  // Matches if the path starts with a valid path qualifier (./, ../, /)
  // eslint-disable-next-line no-unused-vars
  const isStrictRegExp = /^(\/|\.{1,2}(\/|$))/;

  // Matches if the path must point to a directory (ie ends with /)
  const isDirRegExp = /\/$/;

  // Matches if the path starts with a relative path qualifier (./, ../)
  const isRelativeRegexp = /^\.{0,2}\//;

  // We only instantiate one of those so that we can use strict-equal comparisons
  const topLevelLocator = {name: null, reference: null};

  // Used for compatibility purposes - cf setupCompatibilityLayer
  const fallbackLocators: Array<PackageLocator> = [];

  // To avoid emitting the same warning multiple times
  const emittedWarnings = new Set<string>();

  if (runtimeState.enableTopLevelFallback === true)
    fallbackLocators.push(topLevelLocator);

  if (opts.compatibilityMode !== false) {
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
  } = runtimeState as RuntimeState;

  /**
   * Allows to print useful logs just be setting a value in the environment
   */

  function makeLogEntry(name: string, args: Array<any>) {
    return {
      fn: name,
      args,
      error: null as ReturnType<typeof makeError> | Error | null,
      result: null as any,
    };
  }

  function trace(entry: ReturnType<typeof makeLogEntry>) {
    const colors = process.stderr?.hasColors?.() ?? process.stdout.isTTY;
    const c = (n: number | string, str: string) => `\u001b[${n}m${str}\u001b[0m`;

    const error = entry.error;
    if (error)
      console.error(c(`31;1`, `✖ ${entry.error?.message.replace(/\n.*/s, ``)}`));
    else
      console.error(c(`33;1`, `‼ Resolution`));

    if (entry.args.length > 0)
      console.error();
    for (const arg of entry.args)
      console.error(`  ${c(`37;1`, `In ←`)} ${inspect(arg, {colors, compact: true})}`);

    if (entry.result) {
      console.error();
      console.error(`  ${c(`37;1`, `Out →`)} ${inspect(entry.result, {colors, compact: true})}`);
    }

    const stack = new Error().stack!.match(/(?<=^ +)at.*/gm)?.slice(2) ?? [];
    if (stack.length > 0) {
      console.error();
      for (const line of stack) {
        console.error(`  ${c(`38;5;244`, line)}`);
      }
    }

    console.error();
  }

  function maybeLog(name: string, fn: any): any {
    if (opts.allowDebug === false)
      return fn;

    if (Number.isFinite(debugLevel)) {
      if (debugLevel >= 2) {
        return (...args: Array<any>) => {
          const logEntry = makeLogEntry(name, args);
          try {
            return logEntry.result = fn(...args);
          } catch (error) {
            throw logEntry.error = error;
          } finally {
            trace(logEntry);
          }
        };
      } else if (debugLevel >= 1) {
        return (...args: Array<any>) => {
          try {
            return fn(...args);
          } catch (error) {
            const logEntry = makeLogEntry(name, args);
            logEntry.error = error;
            trace(logEntry);
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
        ErrorCode.INTERNAL,
        `Couldn't find a matching entry in the dependency tree for the specified parent (this is probably an internal error)`,
      );
    }

    return packageInformation;
  }

  /**
   * Returns whether the specified locator is a dependency tree root (in which case it's part of the project) or not
   */
  function isDependencyTreeRoot(packageLocator: PackageLocator) {
    if (packageLocator.name === null)
      return true;

    for (const dependencyTreeRoot of runtimeState.dependencyTreeRoots)
      if (dependencyTreeRoot.name === packageLocator.name && dependencyTreeRoot.reference === packageLocator.reference)
        return true;

    return false;
  }

  const defaultExportsConditions = new Set([`default`, `node`, `require`]);

  /**
   * Implements the node resolution for the "exports" field
   *
   * @returns The remapped path or `null` if the package doesn't have a package.json or an "exports" field
   */
  function applyNodeExportsResolution(unqualifiedPath: PortablePath, conditions: Set<string> = defaultExportsConditions) {
    const locator = findPackageLocator(ppath.join(unqualifiedPath, `internal.js` as Filename), {
      resolveIgnored: true,
      includeDiscardFromLookup: true,
    });
    if (locator === null) {
      throw makeError(
        ErrorCode.INTERNAL,
        `The locator that owns the "${unqualifiedPath}" path can't be found inside the dependency tree (this is probably an internal error)`,
      );
    }

    const {packageLocation} = getPackageInformationSafe(locator);

    const manifestPath = ppath.join(packageLocation, Filename.manifest);
    if (!opts.fakeFs.existsSync(manifestPath))
      return null;

    const pkgJson = JSON.parse(opts.fakeFs.readFileSync(manifestPath, `utf8`));

    let subpath = ppath.contains(packageLocation, unqualifiedPath);
    if (subpath === null) {
      throw makeError(
        ErrorCode.INTERNAL,
        `unqualifiedPath doesn't contain the packageLocation (this is probably an internal error)`,
      );
    }

    if (!isRelativeRegexp.test(subpath))
      subpath = `./${subpath}` as PortablePath;

    let resolvedExport;
    try {
      resolvedExport = resolveExport(pkgJson, ppath.normalize(subpath), {
        // TODO: implement support for the --conditions flag
        // Waiting on https://github.com/nodejs/node/issues/36935
        // @ts-expect-error - Type should be Iterable<string>
        conditions,
        unsafe: true,
      });
    } catch (error) {
      throw makeError(
        ErrorCode.EXPORTS_RESOLUTION_FAILED,
        error.message,
        {unqualifiedPath: getPathForDisplay(unqualifiedPath), locator, pkgJson, subpath: getPathForDisplay(subpath), conditions},
        // Currently, resolve.exports only throws ERR_PACKAGE_PATH_NOT_EXPORTED errors, but without assigning the error code.
        // TODO: Use error.code once https://github.com/lukeed/resolve.exports/pull/6 gets merged.
        `ERR_PACKAGE_PATH_NOT_EXPORTED`,
      );
    }

    if (typeof resolvedExport === `string`)
      return ppath.join(packageLocation, resolvedExport as PortablePath);

    return null;
  }

  /**
   * Implements the node resolution for folder access and extension selection
   */
  function applyNodeExtensionResolution(unqualifiedPath: PortablePath, candidates: Array<PortablePath>, {extensions}: {extensions: Array<string>}): PortablePath | null {
    let stat;

    try {
      candidates.push(unqualifiedPath);
      stat = opts.fakeFs.statSync(unqualifiedPath);
    } catch (error) {}

    // If the file exists and is a file, we can stop right there

    if (stat && !stat.isDirectory())
      return opts.fakeFs.realpathSync(unqualifiedPath);

    // If the file is a directory, we must check if it contains a package.json with a "main" entry

    if (stat && stat.isDirectory()) {
      let pkgJson;

      try {
        pkgJson = JSON.parse(opts.fakeFs.readFileSync(ppath.join(unqualifiedPath, Filename.manifest), `utf8`));
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

    for (let i = 0, length = extensions.length; i < length; i++) {
      const candidateFile = `${unqualifiedPath}${extensions[i]}` as PortablePath;
      candidates.push(candidateFile);
      if (opts.fakeFs.existsSync(candidateFile)) {
        return candidateFile;
      }
    }

    // Otherwise, we check if the path is a folder - in such a case, we try to use its index

    if (stat && stat.isDirectory()) {
      for (let i = 0, length = extensions.length; i < length; i++) {
        const candidateFile = ppath.format({dir: unqualifiedPath, name: `index` as Filename, ext: extensions[i]});
        candidates.push(candidateFile);
        if (opts.fakeFs.existsSync(candidateFile)) {
          return candidateFile;
        }
      }
    }

    // Otherwise there's nothing else we can do :(

    return null;
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
    // @ts-expect-error
    const fakeModule = new Module(path, null);
    fakeModule.filename = path;
    fakeModule.paths = Module._nodeModulePaths(path);
    return fakeModule;
  }

  /**
   * Forward the resolution to the next resolver (usually the native one)
   */

  function callNativeResolution(request: PortablePath, issuer: PortablePath): NativePath | false {
    if (issuer.endsWith(`/`))
      issuer = ppath.join(issuer, `internal.js` as Filename);

    // Since we would need to create a fake module anyway (to call _resolveLookupPath that
    // would give us the paths to give to _resolveFilename), we can as well not use
    // the {paths} option at all, since it internally makes _resolveFilename create another
    // fake module anyway.
    return Module._resolveFilename(npath.fromPortablePath(request), makeFakeModule(npath.fromPortablePath(issuer)), false, {plugnplay: false});
  }

  /**
   *
   */

  function isPathIgnored(path: PortablePath) {
    if (ignorePattern === null)
      return false;

    const subPath = ppath.contains(runtimeState.basePath, path);
    if (subPath === null)
      return false;

    if (ignorePattern.test(subPath.replace(/\/$/, ``))) {
      return true;
    } else {
      return false;
    }
  }

  /**
   * This key indicates which version of the standard is implemented by this resolver. The `std` key is the
   * Plug'n'Play standard, and any other key are third-party extensions. Third-party extensions are not allowed
   * to override the standard, and can only offer new methods.
   *
   * If a new version of the Plug'n'Play standard is released and some extensions conflict with newly added
   * functions, they'll just have to fix the conflicts and bump their own version number.
   */

  const VERSIONS = {std: 3, resolveVirtual: 1, getAllLocators: 1};

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
   * Find all packages that depend on the specified one.
   *
   * Note: This is a private function; we expect consumers to implement it
   * themselves. We keep it that way because this implementation isn't
   * optimized at all, since we only need it when printing errors.
   */

  function findPackageDependents({name, reference}: PhysicalPackageLocator): Array<PhysicalPackageLocator> {
    const dependents: Array<PhysicalPackageLocator> = [];

    for (const [dependentName, packageInformationStore] of packageRegistry) {
      if (dependentName === null)
        continue;

      for (const [dependentReference, packageInformation] of packageInformationStore) {
        if (dependentReference === null)
          continue;

        const dependencyReference = packageInformation.packageDependencies.get(name);
        if (dependencyReference !== reference)
          continue;

        // Don't forget that all packages depend on themselves
        if (dependentName === name && dependentReference === reference)
          continue;

        dependents.push({
          name: dependentName,
          reference: dependentReference,
        });
      }
    }

    return dependents;
  }

  /**
   * Find all packages that broke the peer dependency on X, starting from Y.
   *
   * Note: This is a private function; we expect consumers to implement it
   * themselves. We keep it that way because this implementation isn't
   * optimized at all, since we only need it when printing errors.
   */

  function findBrokenPeerDependencies(dependency: string, initialPackage: PhysicalPackageLocator): Array<PhysicalPackageLocator> {
    const brokenPackages = new Map<string, Set<string>>();

    const alreadyVisited = new Set<string>();

    const traversal = (currentPackage: PhysicalPackageLocator) => {
      const identifier = JSON.stringify(currentPackage.name);
      if (alreadyVisited.has(identifier))
        return;

      alreadyVisited.add(identifier);

      const dependents = findPackageDependents(currentPackage);

      for (const dependent of dependents) {
        const dependentInformation = getPackageInformationSafe(dependent);

        if (dependentInformation.packagePeers.has(dependency)) {
          traversal(dependent);
        } else {
          let brokenSet = brokenPackages.get(dependent.name);
          if (typeof brokenSet === `undefined`)
            brokenPackages.set(dependent.name, brokenSet = new Set());

          brokenSet.add(dependent.reference);
        }
      }
    };

    traversal(initialPackage);

    const brokenList: Array<PhysicalPackageLocator> = [];

    for (const name of [...brokenPackages.keys()].sort())
      for (const reference of [...brokenPackages.get(name)!].sort())
        brokenList.push({name, reference});

    return brokenList;
  }

  /**
   * Finds the package locator that owns the specified path. If none is found, returns null instead.
   */

  function findPackageLocator(location: PortablePath, {resolveIgnored = false, includeDiscardFromLookup = false}: {resolveIgnored?: boolean, includeDiscardFromLookup?: boolean} = {}): PhysicalPackageLocator | null {
    if (isPathIgnored(location) && !resolveIgnored)
      return null;

    let relativeLocation = ppath.relative(runtimeState.basePath, location);

    if (!relativeLocation.match(isStrictRegExp))
      relativeLocation = `./${relativeLocation}` as PortablePath;

    if (!relativeLocation.endsWith(`/`))
      relativeLocation = `${relativeLocation}/` as PortablePath;

    do {
      const entry = packageLocatorsByLocations.get(relativeLocation);

      if (typeof entry === `undefined` || (entry.discardFromLookup && !includeDiscardFromLookup)) {
        relativeLocation = relativeLocation.substring(0, relativeLocation.lastIndexOf(`/`, relativeLocation.length - 2) + 1) as PortablePath;
        continue;
      }

      return entry.locator;
    } while (relativeLocation !== ``);

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
      return npath.toPortablePath(opts.pnpapiResolution);

    // Bailout if the request is a native module
    if (considerBuiltins && nodeUtils.isBuiltinModule(request))
      return null;

    const requestForDisplay = getPathForDisplay(request);
    const issuerForDisplay = issuer && getPathForDisplay(issuer);

    // We allow disabling the pnp resolution for some subpaths.
    // This is because some projects, often legacy, contain multiple
    // levels of dependencies (ie. a yarn.lock inside a subfolder of
    // a yarn.lock). This is typically solved using workspaces, but
    // not all of them have been converted already.

    if (issuer && isPathIgnored(issuer)) {
      // Absolute paths that seem to belong to a PnP tree are still
      // handled by our runtime even if the issuer isn't. This is
      // because the native Node resolution uses a special version
      // of the `stat` syscall which would otherwise bypass the
      // filesystem layer we require to access the files.

      if (!ppath.isAbsolute(request) || findPackageLocator(request) === null) {
        const result = callNativeResolution(request, issuer);

        if (result === false) {
          throw makeError(
            ErrorCode.BUILTIN_NODE_RESOLUTION_FAILED,
            `The builtin node resolution algorithm was unable to resolve the requested module (it didn't go through the pnp resolver because the issuer was explicitely ignored by the regexp)\n\nRequire request: "${requestForDisplay}"\nRequired by: ${issuerForDisplay}\n`,
            {request: requestForDisplay, issuer: issuerForDisplay},
          );
        }

        return npath.toPortablePath(result);
      }
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
            ErrorCode.API_ERROR,
            `The resolveToUnqualified function must be called with a valid issuer when the path isn't a builtin nor absolute`,
            {request: requestForDisplay, issuer: issuerForDisplay},
          );
        }

        // We use ppath.join instead of ppath.resolve because:
        // 1) The request is a relative path in this branch
        // 2) ppath.join preserves trailing slashes

        const absoluteIssuer = ppath.resolve(issuer);
        if (issuer.match(isDirRegExp)) {
          unqualifiedPath = ppath.normalize(ppath.join(absoluteIssuer, request));
        } else {
          unqualifiedPath = ppath.normalize(ppath.join(ppath.dirname(absoluteIssuer), request));
        }
      }
    } else {
      // Things are more hairy if it's a package require - we then need to figure out which package is needed, and in
      // particular the exact version for the given location on the dependency tree

      if (!issuer) {
        throw makeError(
          ErrorCode.API_ERROR,
          `The resolveToUnqualified function must be called with a valid issuer when the path isn't a builtin nor absolute`,
          {request: requestForDisplay, issuer: issuerForDisplay},
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
            ErrorCode.BUILTIN_NODE_RESOLUTION_FAILED,
            `The builtin node resolution algorithm was unable to resolve the requested module (it didn't go through the pnp resolver because the issuer doesn't seem to be part of the Yarn-managed dependency tree).\n\nRequire path: "${requestForDisplay}"\nRequired by: ${issuerForDisplay}\n`,
            {request: requestForDisplay, issuer: issuerForDisplay},
          );
        }

        return npath.toPortablePath(result);
      }

      const issuerInformation = getPackageInformationSafe(issuerLocator);

      // We obtain the dependency reference in regard to the package that request it

      let dependencyReference = issuerInformation.packageDependencies.get(dependencyName);
      let fallbackReference: DependencyTarget | null = null;

      // If we can't find it, we check if we can potentially load it from the packages that have been defined as potential fallbacks.
      // It's a bit of a hack, but it improves compatibility with the existing Node ecosystem. Hopefully we should eventually be able
      // to kill this logic and become stricter once pnp gets enough traction and the affected packages fix themselves.

      if (dependencyReference == null) {
        if (issuerLocator.name !== null) {
          // To allow programs to become gradually stricter, starting from the v2 we enforce that workspaces cannot depend on fallbacks.
          // This works by having a list containing all their locators, and checking when a fallback is required whether it's one of them.
          const exclusionEntry = runtimeState.fallbackExclusionList.get(issuerLocator.name);
          const canUseFallbacks = !exclusionEntry || !exclusionEntry.has(issuerLocator.reference);

          if (canUseFallbacks) {
            for (let t = 0, T = fallbackLocators.length; t < T; ++t) {
              const fallbackInformation = getPackageInformationSafe(fallbackLocators[t]);
              const reference = fallbackInformation.packageDependencies.get(dependencyName);

              if (reference == null)
                continue;

              if (alwaysWarnOnFallback)
                fallbackReference = reference;
              else
                dependencyReference = reference;

              break;
            }

            if (runtimeState.enableTopLevelFallback) {
              if (dependencyReference == null && fallbackReference === null) {
                const reference = runtimeState.fallbackPool.get(dependencyName);
                if (reference != null) {
                  fallbackReference = reference;
                }
              }
            }
          }
        }
      }

      // If we can't find the path, and if the package making the request is the top-level, we can offer nicer error messages

      let error: Error | null = null;

      if (dependencyReference === null) {
        if (isDependencyTreeRoot(issuerLocator)) {
          error = makeError(
            ErrorCode.MISSING_PEER_DEPENDENCY,
            `Your application tried to access ${dependencyName} (a peer dependency); this isn't allowed as there is no ancestor to satisfy the requirement. Use a devDependency if needed.\n\nRequired package: ${dependencyName}${dependencyName !== requestForDisplay ? ` (via "${requestForDisplay}")` : ``}\nRequired by: ${issuerForDisplay}\n`,
            {request: requestForDisplay, issuer: issuerForDisplay, dependencyName},
          );
        } else {
          const brokenAncestors = findBrokenPeerDependencies(dependencyName, issuerLocator);
          if (brokenAncestors.every(ancestor => isDependencyTreeRoot(ancestor))) {
            error = makeError(
              ErrorCode.MISSING_PEER_DEPENDENCY,
              `${issuerLocator.name} tried to access ${dependencyName} (a peer dependency) but it isn't provided by your application; this makes the require call ambiguous and unsound.\n\nRequired package: ${dependencyName}${dependencyName !== requestForDisplay ? ` (via "${requestForDisplay}")` : ``}\nRequired by: ${issuerLocator.name}@${issuerLocator.reference} (via ${issuerForDisplay})\n${brokenAncestors.map(ancestorLocator => `Ancestor breaking the chain: ${ancestorLocator.name}@${ancestorLocator.reference}\n`).join(``)}\n`,
              {request: requestForDisplay, issuer: issuerForDisplay, issuerLocator: Object.assign({}, issuerLocator), dependencyName, brokenAncestors},
            );
          } else {
            error = makeError(
              ErrorCode.MISSING_PEER_DEPENDENCY,
              `${issuerLocator.name} tried to access ${dependencyName} (a peer dependency) but it isn't provided by its ancestors; this makes the require call ambiguous and unsound.\n\nRequired package: ${dependencyName}${dependencyName !== requestForDisplay ? ` (via "${requestForDisplay}")` : ``}\nRequired by: ${issuerLocator.name}@${issuerLocator.reference} (via ${issuerForDisplay})\n\n${brokenAncestors.map(ancestorLocator => `Ancestor breaking the chain: ${ancestorLocator.name}@${ancestorLocator.reference}\n`).join(``)}\n`,
              {request: requestForDisplay, issuer: issuerForDisplay, issuerLocator: Object.assign({}, issuerLocator), dependencyName, brokenAncestors},
            );
          }
        }
      } else if (dependencyReference === undefined) {
        if (!considerBuiltins && nodeUtils.isBuiltinModule(request)) {
          if (isDependencyTreeRoot(issuerLocator)) {
            error = makeError(
              ErrorCode.UNDECLARED_DEPENDENCY,
              `Your application tried to access ${dependencyName}. While this module is usually interpreted as a Node builtin, your resolver is running inside a non-Node resolution context where such builtins are ignored. Since ${dependencyName} isn't otherwise declared in your dependencies, this makes the require call ambiguous and unsound.\n\nRequired package: ${dependencyName}${dependencyName !== requestForDisplay ? ` (via "${requestForDisplay}")` : ``}\nRequired by: ${issuerForDisplay}\n`,
              {request: requestForDisplay, issuer: issuerForDisplay, dependencyName},
            );
          } else {
            error = makeError(
              ErrorCode.UNDECLARED_DEPENDENCY,
              `${issuerLocator.name} tried to access ${dependencyName}. While this module is usually interpreted as a Node builtin, your resolver is running inside a non-Node resolution context where such builtins are ignored. Since ${dependencyName} isn't otherwise declared in ${issuerLocator.name}'s dependencies, this makes the require call ambiguous and unsound.\n\nRequired package: ${dependencyName}${dependencyName !== requestForDisplay ? ` (via "${requestForDisplay}")` : ``}\nRequired by: ${issuerForDisplay}\n`,
              {request: requestForDisplay, issuer: issuerForDisplay, issuerLocator: Object.assign({}, issuerLocator), dependencyName},
            );
          }
        } else {
          if (isDependencyTreeRoot(issuerLocator)) {
            error = makeError(
              ErrorCode.UNDECLARED_DEPENDENCY,
              `Your application tried to access ${dependencyName}, but it isn't declared in your dependencies; this makes the require call ambiguous and unsound.\n\nRequired package: ${dependencyName}${dependencyName !== requestForDisplay ? ` (via "${requestForDisplay}")` : ``}\nRequired by: ${issuerForDisplay}\n`,
              {request: requestForDisplay, issuer: issuerForDisplay, dependencyName},
            );
          } else {
            error = makeError(
              ErrorCode.UNDECLARED_DEPENDENCY,
              `${issuerLocator.name} tried to access ${dependencyName}, but it isn't declared in its dependencies; this makes the require call ambiguous and unsound.\n\nRequired package: ${dependencyName}${dependencyName !== requestForDisplay ? ` (via "${requestForDisplay}")` : ``}\nRequired by: ${issuerLocator.name}@${issuerLocator.reference} (via ${issuerForDisplay})\n`,
              {request: requestForDisplay, issuer: issuerForDisplay, issuerLocator: Object.assign({}, issuerLocator), dependencyName},
            );
          }
        }
      }

      if (dependencyReference == null) {
        if (fallbackReference === null || error === null)
          throw error || new Error(`Assertion failed: Expected an error to have been set`);

        dependencyReference = fallbackReference;

        const message = error.message.replace(/\n.*/g, ``);
        error.message = message;

        if (!emittedWarnings.has(message) && debugLevel !== 0) {
          emittedWarnings.add(message);
          process.emitWarning(error);
        }
      }

      // We need to check that the package exists on the filesystem, because it might not have been installed

      const dependencyLocator = Array.isArray(dependencyReference)
        ? {name: dependencyReference[0], reference: dependencyReference[1]}
        : {name: dependencyName, reference: dependencyReference};

      const dependencyInformation = getPackageInformationSafe(dependencyLocator);

      if (!dependencyInformation.packageLocation) {
        throw makeError(
          ErrorCode.MISSING_DEPENDENCY,
          `A dependency seems valid but didn't get installed for some reason. This might be caused by a partial install, such as dev vs prod.\n\nRequired package: ${dependencyLocator.name}@${dependencyLocator.reference}${dependencyLocator.name !== requestForDisplay ? ` (via "${requestForDisplay}")` : ``}\nRequired by: ${issuerLocator.name}@${issuerLocator.reference} (via ${issuerForDisplay})\n`,
          {request: requestForDisplay, issuer: issuerForDisplay, dependencyLocator: Object.assign({}, dependencyLocator)},
        );
      }

      // Now that we know which package we should resolve to, we only have to find out the file location

      // packageLocation is always absolute as it's returned by getPackageInformationSafe
      const dependencyLocation = dependencyInformation.packageLocation;

      if (subPath) {
        // We use ppath.join instead of ppath.resolve because:
        // 1) subPath is always a relative path
        // 2) ppath.join preserves trailing slashes
        unqualifiedPath = ppath.join(dependencyLocation, subPath);
      } else {
        unqualifiedPath = dependencyLocation;
      }
    }

    return ppath.normalize(unqualifiedPath);
  }

  function resolveUnqualifiedExport(request: PortablePath, unqualifiedPath: PortablePath, conditions: Set<string> = defaultExportsConditions) {
    // "exports" only apply when requiring a package, not when requiring via an absolute / relative path
    if (isStrictRegExp.test(request))
      return unqualifiedPath;

    const unqualifiedExportPath = applyNodeExportsResolution(unqualifiedPath, conditions);
    if (unqualifiedExportPath) {
      return ppath.normalize(unqualifiedExportPath);
    } else {
      return unqualifiedPath;
    }
  }

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
      const unqualifiedPathForDisplay = getPathForDisplay(unqualifiedPath);

      const containingPackage = findPackageLocator(unqualifiedPath);
      if (containingPackage) {
        const {packageLocation} = getPackageInformationSafe(containingPackage);

        let exists = true;
        try {
          opts.fakeFs.accessSync(packageLocation);
        } catch (err) {
          if (err?.code === `ENOENT`) {
            exists = false;
          } else {
            const readableError: string = (err?.message ?? err ?? `empty exception thrown`).replace(/^[A-Z]/, ($0: string) => $0.toLowerCase());
            throw makeError(ErrorCode.QUALIFIED_PATH_RESOLUTION_FAILED, `Required package exists but could not be accessed (${readableError}).\n\nMissing package: ${containingPackage.name}@${containingPackage.reference}\nExpected package location: ${getPathForDisplay(packageLocation)}\n`, {unqualifiedPath: unqualifiedPathForDisplay, extensions});
          }
        }

        if (!exists) {
          const errorMessage = packageLocation.includes(`/unplugged/`)
            ? `Required unplugged package missing from disk. This may happen when switching branches without running installs (unplugged packages must be fully materialized on disk to work).`
            : `Required package missing from disk. If you keep your packages inside your repository then restarting the Node process may be enough. Otherwise, try to run an install first.`;

          throw makeError(
            ErrorCode.QUALIFIED_PATH_RESOLUTION_FAILED,
            `${errorMessage}\n\nMissing package: ${containingPackage.name}@${containingPackage.reference}\nExpected package location: ${getPathForDisplay(packageLocation)}\n`,
            {unqualifiedPath: unqualifiedPathForDisplay, extensions},
          );
        }
      }

      throw makeError(
        ErrorCode.QUALIFIED_PATH_RESOLUTION_FAILED,
        `Qualified path resolution failed: we looked for the following paths, but none could be accessed.\n\nSource path: ${unqualifiedPathForDisplay}\n${candidates.map(candidate => `Not found: ${getPathForDisplay(candidate)}\n`).join(``)}`,
        {unqualifiedPath: unqualifiedPathForDisplay, extensions},
      );
    }
  }

  /**
   * Transforms a request into a fully qualified path.
   *
   * Note that it is extremely important that the `issuer` path ends with a forward slash if the issuer is to be
   * treated as a folder (ie. "/tmp/foo/" rather than "/tmp/foo" if "foo" is a directory). Otherwise relative
   * imports won't be computed correctly (they'll get resolved relative to "/tmp/" instead of "/tmp/foo/").
   */

  function resolveRequest(request: PortablePath, issuer: PortablePath | null, {considerBuiltins, extensions, conditions}: ResolveRequestOptions = {}): PortablePath | null {
    try {
      const unqualifiedPath = resolveToUnqualified(request, issuer, {considerBuiltins});

      // If the request is the pnpapi, we can just return the unqualifiedPath
      // without having to apply the exports resolution or the extension resolution
      // (opts.pnpapiResolution is always a full path - makeManager enforces this by stat-ing it)
      if (request === `pnpapi`)
        return unqualifiedPath;

      if (unqualifiedPath === null)
        return null;

      const isIssuerIgnored = () =>
        issuer !== null
          ? isPathIgnored(issuer)
          : false;

      const remappedPath = (!considerBuiltins || !nodeUtils.isBuiltinModule(request)) && !isIssuerIgnored()
        ? resolveUnqualifiedExport(request, unqualifiedPath, conditions)
        : unqualifiedPath;

      return resolveUnqualified(remappedPath, {extensions});
    } catch (error) {
      if (Object.prototype.hasOwnProperty.call(error, `pnpCode`))
        Object.assign(error.data, {request: getPathForDisplay(request), issuer: issuer && getPathForDisplay(issuer)});

      throw error;
    }
  }

  function resolveVirtual(request: PortablePath) {
    const normalized = ppath.normalize(request);
    const resolved = VirtualFS.resolveVirtual(normalized);

    return resolved !== normalized ? resolved : null;
  }

  return {
    VERSIONS,
    topLevel,

    getLocator: (name: string, referencish: [string, string] | string): PhysicalPackageLocator => {
      if (Array.isArray(referencish)) {
        return {name: referencish[0], reference: referencish[1]};
      } else {
        return {name, reference: referencish};
      }
    },

    getDependencyTreeRoots: () => {
      return [...runtimeState.dependencyTreeRoots];
    },

    getAllLocators() {
      const locators: Array<PhysicalPackageLocator> = [];

      for (const [name, entry] of packageRegistry)
        for (const reference of entry.keys())
          if (name !== null && reference !== null)
            locators.push({name, reference});

      return locators;
    },

    getPackageInformation: (locator: PackageLocator) => {
      const info = getPackageInformation(locator);

      if (info === null)
        return null;

      const packageLocation = npath.fromPortablePath(info.packageLocation);
      const nativeInfo = {...info, packageLocation};

      return nativeInfo;
    },

    findPackageLocator: (path: string) => {
      return findPackageLocator(npath.toPortablePath(path));
    },

    resolveToUnqualified: maybeLog(`resolveToUnqualified`, (request: NativePath, issuer: NativePath | null, opts?: ResolveToUnqualifiedOptions) => {
      const portableIssuer = issuer !== null ?  npath.toPortablePath(issuer) : null;

      const resolution = resolveToUnqualified(npath.toPortablePath(request), portableIssuer, opts);
      if (resolution === null)
        return null;

      return npath.fromPortablePath(resolution);
    }),

    resolveUnqualified: maybeLog(`resolveUnqualified`, (unqualifiedPath: NativePath, opts?: ResolveUnqualifiedOptions) => {
      return npath.fromPortablePath(resolveUnqualified(npath.toPortablePath(unqualifiedPath), opts));
    }),

    resolveRequest: maybeLog(`resolveRequest`, (request: NativePath, issuer: NativePath | null, opts?: ResolveRequestOptions) => {
      const portableIssuer = issuer !== null ? npath.toPortablePath(issuer) : null;

      const resolution = resolveRequest(npath.toPortablePath(request), portableIssuer, opts);
      if (resolution === null)
        return null;

      return npath.fromPortablePath(resolution);
    }),

    resolveVirtual: maybeLog(`resolveVirtual`, (path: NativePath) => {
      const result = resolveVirtual(npath.toPortablePath(path));

      if (result !== null) {
        return npath.fromPortablePath(result);
      } else {
        return null;
      }
    }),
  };
}
