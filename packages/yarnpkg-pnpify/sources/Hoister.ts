import {PortablePath, Filename, NodeFS, toFilename, ppath} from '@yarnpkg/fslib';
import {PnpApi, PackageLocator}                            from '@yarnpkg/pnp';

import {RawHoister, PackageTree, PackageMap, PackageId}    from './RawHoister';

type PnpWalkApi = Pick<PnpApi, 'getPackageInformation' | 'getDependencyTreeRoots' | 'topLevel'>;

/**
 * Node modules mapping
 */
interface NodeModulesMap {
  /** Directory entries for `../node_modules` and `../node_modules/@foo` directories */
  dirEntries: Map<PortablePath, Set<Filename>>;
  /** Package location mapping: `../node_modules/@foo/bar` -> `pnp package location` */
  packageLocations: Map<PortablePath, PortablePath>;
};

/** node_modules path segment */
const NODE_MODULES = toFilename('node_modules');

/** Package locator key for usage inside maps */
type LocatorKey = string;

/**
 * Retrieves full package list from PnP API and builds hoisted `node_modules` directories
 * representation in-memory.
 */
export class Hoister {
  /** Raw hoister which does all the hoisting heavy lifting */
  private rawHoister = new RawHoister();

  /**
   * Retrieve full package list and build hoisted `node_modules` directories
   * representation in-memory.
   *
   * @param pnp PnP API
   *
   * @returns hoisted `node_modules` directories representation in-memory
   */
  public hoist(pnp: PnpWalkApi): NodeModulesMap {
    const dirEntries: Map<PortablePath, Set<Filename>> = new Map();
    const packageLocations: Map<PortablePath, PortablePath> = new Map();

    const packageTree: PackageTree = new Map();
    const packageNameMap: PackageMap = new Map();
    const packageToLocatorMap = new Map<PackageId, PackageLocator>();
    const locatorToPackageMap = new Map<LocatorKey, PackageId>();

    const pnpRoots = pnp.getDependencyTreeRoots ? pnp.getDependencyTreeRoots() : [pnp.topLevel];

    let lastPkgId = 0;

    const getLocatorKey = (locator: PackageLocator): LocatorKey => `${locator.name}:${locator.reference}`;

    const assignPackageId = (locator: PackageLocator) => {
      const locatorKey = getLocatorKey(locator);
      let pkgId = locatorToPackageMap.get(locatorKey);
      if (!pkgId) {
        pkgId = lastPkgId++;
        locatorToPackageMap.set(locatorKey, pkgId);
        packageToLocatorMap.set(pkgId, locator);
        packageNameMap.set(pkgId, {name: locator.name!, weight: 1});
      }
      return pkgId;
    };

    const addPackageToTree = (parent: PackageLocator,  parentPkgId: PackageId) => {
      const pkg = pnp.getPackageInformation(parent);
      if (pkg) {
        const depIds = new Set<PackageId>();
        packageTree.set(parentPkgId, depIds);

        for (const [name, reference] of pkg.packageDependencies) {
          if (reference) {
            const locator = typeof reference === 'string' ? {name, reference} : {name: reference[0], reference: reference[1]};
            const pkgId = assignPackageId(locator);
            if (!packageTree.has(pkgId)) {
              depIds.add(pkgId);
              addPackageToTree(locator, pkgId);
            }
          }
        }
      }
    };

    for (const locator of pnpRoots)
      addPackageToTree(locator, assignPackageId(locator));

    const hoistedTree = this.rawHoister.hoist(packageTree, packageNameMap);

    const NO_DEPS = new Set<PackageId>();
    const getLocation = (locator: PackageLocator): PortablePath =>
      NodeFS.toPortablePath(pnp.getPackageInformation(locator)!.packageLocation);
    const getPackageName = (locator: PackageLocator): { name: Filename, scope: Filename | null } => {
      const [nameOrScope, name] = locator.name!.split('/');
      return name ? {scope: toFilename(nameOrScope), name: toFilename(name)} : {scope: null, name: toFilename(nameOrScope)};
    };

    const buildLocationTree = (nodeId: PackageId, prefix: PortablePath) => {
      const entries = new Map<Filename, PackageLocator | null>();
      const scopeMap = new Map<Filename, Map<Filename, PackageLocator>>();
      const depIds = hoistedTree.get(nodeId) || NO_DEPS;
      for (const depId of depIds) {
        const locator = packageToLocatorMap.get(depId)!;
        const {name, scope} = getPackageName(locator);
        let depPrefix = ppath.join(...([prefix, NODE_MODULES].concat(scope ? [scope, name] : [name])));
        buildLocationTree(depId, depPrefix);
        if (scope) {
          let scopeEntries = scopeMap.get(scope);
          if (!scopeEntries) {
            scopeEntries = new Map();
            scopeMap.set(scope, scopeEntries);
          }
          scopeEntries.set(name, locator);
          entries.set(scope, null);
        } else {
          entries.set(name, locator);
        }
      }

      if (entries.size > 0) {
        dirEntries.set(ppath.join(prefix, NODE_MODULES), new Set(Array.from(entries.keys()).sort()));
        for (const [entry, locator] of entries) {
          if (locator) {
            packageLocations.set(ppath.join(prefix, NODE_MODULES, entry), getLocation(locator));
          } else {
            const scopeEntries = scopeMap.get(entry)!;
            dirEntries.set(ppath.join(prefix, NODE_MODULES, entry), new Set(Array.from(scopeEntries.keys()).sort()));
            for (const [scopeEntry, locator] of scopeEntries) {
              packageLocations.set(ppath.join(prefix, NODE_MODULES, entry, scopeEntry), getLocation(locator));
            }
          }
        }
      }
    };

    const rootPrefix = getLocation(packageToLocatorMap.get(0)!);
    buildLocationTree(0, rootPrefix);

    return {dirEntries, packageLocations};
  }
}
