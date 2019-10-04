import {PortablePath, Filename, NodeFS, toFilename, ppath} from '@yarnpkg/fslib';
import {PnpApi, PackageLocator}                            from '@yarnpkg/pnp';

import {RawHoister, PackageTree, PackageMap, PackageId}    from './RawHoister';

type PnpWalkApi = Pick<PnpApi, 'getPackageInformation' | 'getDependencyTreeRoots' | 'topLevel'>;

/**
 * The tree of package locations. The key is a path to node_modules folder.
 * The value is a directory entry list or final package location.
 */
type LocationTree = Map<PortablePath, Set<Filename> | PortablePath>;

export class Hoister {
  private rawHoister = new RawHoister();

  public hoist(pnp: PnpWalkApi): LocationTree {
    const locationTree = new Map();
    const packageTree: PackageTree = new Map();
    const packageMap: PackageMap = new Map();
    const packageToLocator = new Map<PackageId, PackageLocator>();
    const locatorToPackage = new Map<string, PackageId>();

    const pnpRoots = pnp.getDependencyTreeRoots ? pnp.getDependencyTreeRoots() : [pnp.topLevel];

    let lastPkgId = 0;

    const getLocatorKey = (locator: PackageLocator) => `${locator.name}:${locator.reference}`;

    const assignPackageId = (locator: PackageLocator) => {
      const locatorKey = getLocatorKey(locator);
      let pkgId = locatorToPackage.get(locatorKey);
      if (!pkgId) {
        pkgId = lastPkgId++;
        locatorToPackage.set(locatorKey, pkgId);
        packageToLocator.set(pkgId, locator);
        packageMap.set(pkgId, {name: locator.name!, weight: 1});
      }
      return pkgId;
    };

    const buildPackageTree = (parent: PackageLocator) => {
      const parentPkgId = assignPackageId(parent);
      const depIds = new Set<PackageId>();
      packageTree.set(parentPkgId, depIds);

      const pkg = pnp.getPackageInformation(parent);
      if (pkg) {
        for (const [name, reference] of pkg.packageDependencies) {
          if (reference) {
            const locator = typeof reference === 'string' ? {name, reference} : {name: reference[0], reference: reference[1]};
            const pkgId = assignPackageId(locator);
            depIds.add(pkgId);
            if (!packageTree.has(pkgId)) {
              buildPackageTree(locator);
            }
          }
        }
      }
    };

    for (const locator of pnpRoots)
      buildPackageTree(locator);

    const hoistedTree = this.rawHoister.hoist(packageTree, packageMap);

    const NO_DEPS = new Set<PackageId>();
    const getLocation = (locator: PackageLocator): PortablePath =>
      NodeFS.toPortablePath(pnp.getPackageInformation(locator)!.packageLocation);
    const getPackageName = (locator: PackageLocator): { name: Filename, scope: Filename | null } => {
      const [nameOrScope, name] = locator.name!.split('/');
      return name ? {scope: toFilename(nameOrScope), name: toFilename(name)} : {scope: null, name: toFilename(nameOrScope)};
    };

    const NODE_MODULES_SEGMENT = toFilename('node_modules');
    const buildLocationTree = (nodeId: PackageId, prefix: PortablePath) => {
      const entries = new Map<Filename, PackageLocator | null>();
      const scopeMap = new Map<Filename, Map<Filename, PackageLocator>>();
      const depIds = hoistedTree.get(nodeId) || NO_DEPS;
      for (const depId of depIds) {
        const locator = packageToLocator.get(depId)!;
        const {name, scope} = getPackageName(locator);
        let depPrefix = ppath.join(...([prefix, NODE_MODULES_SEGMENT].concat(scope ? [scope, name] : [name])));
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
        locationTree.set(prefix, new Set([NODE_MODULES_SEGMENT]));
        const sortedEntries = Array.from(entries.keys()).sort();
        locationTree.set(ppath.join(prefix, NODE_MODULES_SEGMENT), new Set(sortedEntries));
        for (const entry of sortedEntries) {
          const locator = entries.get(entry);
          if (locator) {
            locationTree.set(ppath.join(prefix, NODE_MODULES_SEGMENT, entry), getLocation(locator));
          } else {
            const scopeEntries = scopeMap.get(entry)!;
            const sortedScopeEntries = Array.from(scopeEntries.keys()).sort();
            locationTree.set(ppath.join(prefix, NODE_MODULES_SEGMENT, entry), new Set(sortedScopeEntries));
            for (const scopeEntry of sortedScopeEntries) {
              locationTree.set(ppath.join(prefix, NODE_MODULES_SEGMENT, entry, scopeEntry), getLocation(scopeEntries.get(scopeEntry)!));
            }
          }
        }
      }
    };

    const rootPrefix = getLocation(packageToLocator.get(0)!);
    buildLocationTree(0, rootPrefix);

    return locationTree;
  }
}
