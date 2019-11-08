import {NativePath, PortablePath, Filename, toFilename, npath, ppath}            from '@yarnpkg/fslib';
import {PnpApi, PackageLocator, PackageInformation}                              from '@yarnpkg/pnp';

import fs                                                                        from 'fs';

import {hoist, ReadonlyHoisterPackageTree, HoisterPackageId, HoisterPackageInfo} from './hoist';
import {HoistedTree, HoisterPackageTree}                                         from './hoist';

// Babel doesn't support const enums, thats why we use non-const enum for LinkType in @yarnpkg/pnp
// But because of this TypeScript requires @yarnpkg/pnp during runtime
// To prevent this we redeclare LinkType enum here, to not depend on @yarnpkg/pnp during runtime
export enum LinkType {HARD = 'HARD', SOFT = 'SOFT'};

type PnpWalkApi = Pick<PnpApi, 'getPackageInformation' | 'getDependencyTreeRoots' | 'topLevel' | 'resolveVirtual'>;

/**
 * Node modules tree.
 */
export type NodeModulesTree = Map<PortablePath, Set<Filename> | [PortablePath, LinkType]>;

export interface NodeModulesTreeOptions {
  optimizeSizeOnDisk?: boolean;
  pnpifyFs?: boolean;
}

/** node_modules path segment */
const NODE_MODULES = toFilename(`node_modules`);
const NODE_MODULES_SUFFIX = `/node_modules`;

/** Package locator key for usage inside maps */
type LocatorKey = string;

/**
 * Retrieve full package list and build hoisted `node_modules` directories
 * representation in-memory.
 *
 * @param pnp PnP API
 *
 * @returns hoisted `node_modules` directories representation in-memory
 */
export const buildNodeModulesTree = (pnp: PnpWalkApi, options: NodeModulesTreeOptions): NodeModulesTree => {
  const {packageTree, packages, locators} = buildPackageTree(pnp, options);

  const hoistedTree = hoist(packageTree, packages);

  return populateNodeModulesTree(pnp, hoistedTree, locators, options);
};

/**
 * Traverses PnP tree and produces input for the `RawHoister`
 *
 * @param pnp PnP API
 *
 * @returns package tree, packages info and locators
 */
const buildPackageTree = (pnp: PnpWalkApi, options: NodeModulesTreeOptions): { packageTree: ReadonlyHoisterPackageTree, packages: HoisterPackageInfo[], locators: PackageLocator[] } => {
  const packageTree: HoisterPackageTree = [];
  const packages: HoisterPackageInfo[] = [];
  const locators: PackageLocator[] = [];
  const locatorToPackageMap = new Map<LocatorKey, HoisterPackageId>();
  const packageInfos: PackageInformation<NativePath>[] = [];

  const pnpRoots = pnp.getDependencyTreeRoots ? pnp.getDependencyTreeRoots() : [pnp.topLevel];

  let lastPkgId = 0;

  const getLocatorKey = (locator: PackageLocator): LocatorKey => `${locator.name}:${locator.reference}`;

  const assignPackageId = (locator: PackageLocator, pkg: PackageInformation<NativePath>) => {
    const locatorKey = getLocatorKey(locator);
    let pkgId = locatorToPackageMap.get(locatorKey);
    if (!pkgId) {
      pkgId = lastPkgId;
      lastPkgId++;
      const packagePath = npath.toPortablePath(pkg.packageLocation);
      let weight = 1;
      if (options.optimizeSizeOnDisk && packagePath.indexOf(`.zip${NODE_MODULES_SUFFIX}`) > 0)
        weight = fs.statSync(packagePath.split(NODE_MODULES_SUFFIX)[0]).size;

      locatorToPackageMap.set(locatorKey, pkgId);
      locators.push(locator);
      packages.push({name: locator.name!, weight});
      packageInfos.push(pkg);
    }
    return pkgId;
  };

  const getPackageId = (locator: PackageLocator) => locatorToPackageMap.get(getLocatorKey(locator));

  const addedIds = new Set<HoisterPackageId>();
  const addPackageToTree = (pkg: PackageInformation<NativePath>, pkgId: HoisterPackageId, parentDepIds: Set<HoisterPackageId>) => {
    addedIds.add(pkgId);
    const deps = new Set<HoisterPackageId>();
    const peerDeps = new Set<HoisterPackageId>();
    packageTree[pkgId] = {deps, peerDeps};

    for (const [name, reference] of pkg.packageDependencies) {
      if (reference) {
        const locator = typeof reference === 'string' ? {name, reference} : {name: reference[0], reference: reference[1]};
        const depPkgId = getPackageId(locator);
        if (depPkgId) {
          if (pkg.packagePeers) {
            if (pkg.packagePeers.has(name)) {
              peerDeps.add(depPkgId);
            } else {
              deps.add(depPkgId);
            }
          } else {
            if (parentDepIds.has(depPkgId) && depPkgId !== pkgId) {
              peerDeps.add(depPkgId);
            } else {
              deps.add(depPkgId);
            }
          }
        }
      }
    }

    const allDepIds = new Set(Array.from(deps).concat(Array.from(peerDeps)));
    for (const depId of allDepIds) {
      const depPkg = packageInfos[depId];
      if (depPkg && !addedIds.has(depId)) {
        addPackageToTree(depPkg, depId, allDepIds);
      }
    }
  };

  const assignedIds = new Set<HoisterPackageId>();
  const assignPackageIds = (pkgId: HoisterPackageId) => {
    assignedIds.add(pkgId);
    const pkg = packageInfos[pkgId];
    for (const [name, reference] of pkg.packageDependencies) {
      if (reference) {
        const locator = typeof reference === 'string' ? {name, reference} : {name: reference[0], reference: reference[1]};
        const depPkg = pnp.getPackageInformation(locator);
        if (depPkg) {
          const depPkgId = assignPackageId(locator, depPkg);
          if (!assignedIds.has(depPkgId)) {
            assignPackageIds(depPkgId);
          }
        }
      }
    }
  };

  const pkg = pnp.getPackageInformation(pnp.topLevel)!;
  const topLocatorKey = getLocatorKey(pnp.topLevel);
  for (const locator of pnpRoots) {
    if (getLocatorKey(locator) !== topLocatorKey) {
      pkg.packageDependencies.set(locator.name!, locator.reference);
    }
  }
  const pkgId = assignPackageId(pnp.topLevel, pkg);
  assignPackageIds(pkgId);

  addPackageToTree(pkg, pkgId, new Set<number>());

  return {packageTree, packages, locators};
};


/**
 * Converts hoisted tree to node modules map
 *
 * @param pnp PnP API
 * @param hoistedTree hoisted package tree from `RawHoister`
 * @param locators locators
 *
 * @returns node modules map
 */
const populateNodeModulesTree = (pnp: PnpWalkApi, hoistedTree: HoistedTree, locators: PackageLocator[], options: NodeModulesTreeOptions): NodeModulesTree => {
  const tree: NodeModulesTree = new Map();

  // Hard link Regex heuristics, needed for old PnP API versions support
  const HARD_LINK_REGEX = /((\.zip|-integrity)[\\/]node_modules[\\/]|-virtual-[0-9a-f]{10})/;

  const NO_DEPS = new Set<HoisterPackageId>();
  const getLocation = (locator: PackageLocator): [PortablePath, LinkType] => {
    const info = pnp.getPackageInformation(locator)!;
    if (pnp.resolveVirtual) {
      const truePath = (!options.pnpifyFs && locator.reference && locator.reference.startsWith('virtual:')) ? pnp.resolveVirtual(info.packageLocation) : info.packageLocation;
      return [npath.toPortablePath(truePath || info.packageLocation), info.linkType];
    } else {
      const linkType = info.linkType || HARD_LINK_REGEX.test(info.packageLocation) ? LinkType.HARD : LinkType.SOFT;
      if (linkType === LinkType.SOFT && locator.reference && locator.reference!.indexOf('virtual:') === 0) {
        const realLocator = {name: locator.name!, reference: locator.reference!.split('#')[1]};
        const realInfo = pnp.getPackageInformation(realLocator)!;
        if (!realInfo) {
          return [npath.toPortablePath(info.packageLocation), LinkType.HARD];
        } else {
          return [npath.toPortablePath(realInfo.packageLocation), linkType];
        }
      } else {
        return [npath.toPortablePath(info.packageLocation), linkType];
      }
    }
  };
  const getPackageName = (locator: PackageLocator): { name: Filename, scope: Filename | null } => {
    const [nameOrScope, name] = locator.name!.split('/');
    return name ? {scope: toFilename(nameOrScope), name: toFilename(name)} : {scope: null, name: toFilename(nameOrScope)};
  };

  const seenPkgIds = new Set();
  const buildTree = (nodeId: HoisterPackageId, prefix: PortablePath) => {
    seenPkgIds.add(nodeId);
    const depIds = hoistedTree[nodeId] || NO_DEPS;
    for (const depId of depIds) {
      const locator = locators[depId];
      const {name, scope} = getPackageName(locator);
      const packageNameParts = scope ? [scope, name] : [name];
      const nodeModulesDirPath = ppath.join(prefix, NODE_MODULES);
      let depPrefix = ppath.join(...([nodeModulesDirPath].concat(packageNameParts)));
      if (!seenPkgIds.has(depId)) {
        const nodeVal = getLocation(locator);
        tree.set(depPrefix, nodeVal);

        const segments = depPrefix.split(NODE_MODULES_SUFFIX);
        let segCount = segments.length - 1;
        while (segCount > 0) {
          const nodePath = npath.toPortablePath(segments.slice(0, segCount).join(NODE_MODULES_SUFFIX));
          const pathSubdirs = segments[segCount].split(ppath.sep).slice(1);
          let pathSubdirCount = pathSubdirs.length - 1;
          let hasTreeNodes = false;
          while (pathSubdirCount >= 0) {
            const dirPath = ppath.join(nodePath, NODE_MODULES, ...pathSubdirs.slice(0, pathSubdirCount).map(x => toFilename(x)));
            const targetDir = toFilename(pathSubdirs[pathSubdirCount]);
            const subdirs = tree.get(dirPath);
            if (!subdirs) {
              tree.set(dirPath, new Set([targetDir]));
            } else if (subdirs instanceof Set) {
              if (subdirs.has(targetDir)) {
                hasTreeNodes = true;
                break;
              } else {
                subdirs.add(targetDir);
              }
            }
            pathSubdirCount--;
          }
          if (hasTreeNodes)
            break;

          segCount--;
        }
        buildTree(depId, depPrefix);
      }
    }
  };

  const [rootPrefix] = getLocation(locators[0]);
  buildTree(0, rootPrefix);

  if (options.pnpifyFs) {
    for (const key of tree.keys()) {
      const nodeVal = tree.get(key);
      if (nodeVal instanceof Array && nodeVal[1] === LinkType.HARD) {
        const nodeModulesDir = ppath.join(key, NODE_MODULES);
        if (tree.has(nodeModulesDir)) {
          tree.set(ppath.join(nodeVal[0], NODE_MODULES), [nodeModulesDir, LinkType.SOFT]);
        }
      }
    }
  }

  const sortedTree: NodeModulesTree = new Map();

  const keys = Array.from(tree.keys()).sort();
  for (const key of keys) {
    const val = tree.get(key)!;
    sortedTree.set(key, val instanceof Set ? new Set(Array.from(val).sort()) : val);
  }

  return sortedTree;
};
