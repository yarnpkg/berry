import {PortablePath, Filename, NodeFS, toFilename, ppath}       from '@yarnpkg/fslib';
import {PnpApi, PackageLocator, LinkType}                        from '@yarnpkg/pnp';

import fs                                                        from 'fs';

import {RawHoister, ReadonlyPackageTree, PackageId, PackageInfo} from './RawHoister';
import {HoistedTree, PackageTree}                                from './RawHoister';

type PnpWalkApi = Pick<PnpApi, 'getPackageInformation' | 'getDependencyTreeRoots' | 'topLevel'>;

/**
 * Node modules tree.
 */
export type NodeModulesTree = Map<PortablePath, Set<Filename> | [PortablePath, LinkType]>;

export interface HoisterOptions {
  optimizeSizeOnDisk: boolean;
}

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
  private readonly rawHoister = new RawHoister();

  /** Hoister options */
  private readonly options: HoisterOptions;

  public constructor(options: HoisterOptions = {optimizeSizeOnDisk: false}) {
    this.options = options;
  }

  /**
   * Traverses PnP tree and produces input for the `RawHoister`
   *
   * @param pnp PnP API
   *
   * @returns package tree, packages info and locators
   */
  private buildPackageTree(pnp: PnpWalkApi): { packageTree: ReadonlyPackageTree, packages: PackageInfo[], locators: PackageLocator[] } {
    const packageTree: PackageTree = [];
    const packages: PackageInfo[] = [];
    const locators: PackageLocator[] = [];
    const locatorToPackageMap = new Map<LocatorKey, PackageId>();

    const pnpRoots = pnp.getDependencyTreeRoots ? pnp.getDependencyTreeRoots() : [pnp.topLevel];

    let lastPkgId = 0;

    const getLocatorKey = (locator: PackageLocator): LocatorKey => `${locator.name}:${locator.reference}`;

    const assignPackageId = (locator: PackageLocator, weight: number) => {
      const locatorKey = getLocatorKey(locator);
      let pkgId = locatorToPackageMap.get(locatorKey);
      if (!pkgId) {
        pkgId = lastPkgId++;
        locatorToPackageMap.set(locatorKey, pkgId);
        locators.push(locator);
        packages.push({name: locator.name!, weight});
      }
      return pkgId;
    };

    const seenIds = new Set<PackageId>();

    const addPackageToTree = (parent: PackageLocator,  parentPkgId: PackageId) => {
      seenIds.add(parentPkgId);
      const pkg = pnp.getPackageInformation(parent);
      if (pkg) {
        const depIds = new Set<PackageId>();
        packageTree.push({deps: depIds, peerDeps: new Set<PackageId>()});

        for (const [name, reference] of pkg.packageDependencies) {
          if (reference) {
            const locator = typeof reference === 'string' ? {name, reference} : {name: reference[0], reference: reference[1]};
            const weight = !this.options.optimizeSizeOnDisk || pkg.packageLocation.indexOf('.zip/node_modules') < 0 ? 1 : fs.statSync(pkg.packageLocation.split('/node_modules')[0]).size;
            const pkgId = assignPackageId(locator, weight);

            depIds.add(pkgId);
            if (!packageTree[pkgId]) {
              addPackageToTree(locator, pkgId);
            }
          }
        }
      }
    };

    for (const locator of pnpRoots)
      addPackageToTree(locator, 0);

    return {packageTree, packages, locators};
  }

  /**
   * Converts hoisted tree to node modules map
   *
   * @param pnp PnP API
   * @param hoistedTree hoisted package tree from `RawHoister`
   * @param locators locators
   *
   * @returns node modules map
   */
  private buildNodeModulesTree(pnp: PnpWalkApi, hoistedTree: HoistedTree, locators: PackageLocator[]): NodeModulesTree {
    const tree: NodeModulesTree = new Map();

    const NO_DEPS = new Set<PackageId>();
    const getLocation = (locator: PackageLocator): [PortablePath, LinkType] => {
      const info = pnp.getPackageInformation(locator)!;
      if (info.linkType === LinkType.SOFT && locator.reference!.indexOf('virtual:') === 0) {
        const realLocator = {name: locator.name!, reference: locator.reference!.split('#')[1]};
        const realInfo = pnp.getPackageInformation(realLocator)!;
        return [NodeFS.toPortablePath(realInfo.packageLocation), realInfo.linkType];
      } else {
        return [NodeFS.toPortablePath(info.packageLocation), info.linkType];
      }
    };
    const getPackageName = (locator: PackageLocator): { name: Filename, scope: Filename | null } => {
      const [nameOrScope, name] = locator.name!.split('/');
      return name ? {scope: toFilename(nameOrScope), name: toFilename(name)} : {scope: null, name: toFilename(nameOrScope)};
    };

    const seenPkgIds = new Set();
    const buildTree = (nodeId: PackageId, prefix: PortablePath) => {
      seenPkgIds.add(nodeId);
      // const entries = new Map<Filename, PackageLocator | null>();
      const depIds = hoistedTree[nodeId] || NO_DEPS;
      for (const depId of depIds) {
        const locator = locators[depId];
        const {name, scope} = getPackageName(locator);
        const packageNameParts = scope ? [scope, name] : [name];
        const nodeModulesDirPath = ppath.join(prefix, NODE_MODULES);
        let depPrefix = ppath.join(...([nodeModulesDirPath].concat(packageNameParts)));
        if (!seenPkgIds.has(depId)) {
          tree.set(depPrefix, getLocation(locator));
          const segments = depPrefix.split(ppath.sep);
          let count = segments.length - 1;
          while (count > 0) {
            const nodePath = NodeFS.toPortablePath(segments.slice(0, count).join(ppath.sep) || '/');
            const subdirs = tree.get(nodePath);
            const nextSegment = toFilename(segments[count]);
            if (!subdirs) {
              tree.set(nodePath, new Set([nextSegment]));
            } else if (subdirs instanceof Set) {
              if (subdirs.has(nextSegment)) {
                break;
              } else {
                subdirs.add(nextSegment);
              }
            }

            count--;
          }
          buildTree(depId, depPrefix);
        }
      }
    };

    const [rootPrefix] = getLocation(locators[0]);
    buildTree(0, rootPrefix);

    const sortedTree: NodeModulesTree = new Map();

    const keys = Array.from(tree.keys()).sort();
    for (const key of keys) {
      const val = tree.get(key)!;
      sortedTree.set(key, val instanceof Set ? new Set(Array.from(val).sort()) : val);
    }

    return sortedTree;
  }

  /**
   * Retrieve full package list and build hoisted `node_modules` directories
   * representation in-memory.
   *
   * @param pnp PnP API
   *
   * @returns hoisted `node_modules` directories representation in-memory
   */
  public hoist(pnp: PnpWalkApi): NodeModulesTree {
    const {packageTree, packages, locators} = this.buildPackageTree(pnp);

    const hoistedTree = this.rawHoister.hoist(packageTree, packages);

    return this.buildNodeModulesTree(pnp, hoistedTree, locators);
  }
}
