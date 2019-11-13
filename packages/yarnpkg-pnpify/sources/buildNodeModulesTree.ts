import {NativePath, PortablePath, Filename, toFilename, npath, ppath}            from '@yarnpkg/fslib';
import {PnpApi, PackageLocator, PackageInformation}                              from '@yarnpkg/pnp';

import fs                                                                        from 'fs';

import {hoist, ReadonlyHoisterPackageTree, HoisterPackageId, HoisterPackageInfo} from './hoist';
import {HoistedTree, HoisterPackageTree}                                         from './hoist';

// Babel doesn't support const enums, thats why we use non-const enum for LinkType in @yarnpkg/pnp
// But because of this TypeScript requires @yarnpkg/pnp during runtime
// To prevent this we redeclare LinkType enum here, to not depend on @yarnpkg/pnp during runtime
export enum LinkType {HARD = 'HARD', SOFT = 'SOFT'};

/**
 * Node modules tree.
 */
export type NodeModulesTree = Map<PortablePath, {dirList: Set<Filename>} | {dirList?: undefined, target: PortablePath, linkType: LinkType}>;

export interface NodeModulesTreeOptions {
  optimizeSizeOnDisk?: boolean;
  pnpifyFs?: boolean;
}

/** node_modules path segment */
const NODE_MODULES = toFilename(`node_modules`);

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
export const buildNodeModulesTree = (pnp: PnpApi, options: NodeModulesTreeOptions): NodeModulesTree => {
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
const buildPackageTree = (pnp: PnpApi, options: NodeModulesTreeOptions): { packageTree: ReadonlyHoisterPackageTree, packages: HoisterPackageInfo[], locators: PackageLocator[] } => {
  const packageTree: HoisterPackageTree = [];
  const packages: HoisterPackageInfo[] = [];
  const locators: PackageLocator[] = [];
  const locatorToPackageMap = new Map<LocatorKey, HoisterPackageId>();
  const packageInfos: PackageInformation<NativePath>[] = [];

  const pnpRoots = pnp.getDependencyTreeRoots();

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
      if (options.optimizeSizeOnDisk && packagePath.indexOf(`.zip/${NODE_MODULES}/`) > 0)
        weight = fs.statSync(packagePath.split(`/${NODE_MODULES}/`)[0]).size;

      locatorToPackageMap.set(locatorKey, pkgId);
      locators.push(locator);
      packages.push({name: locator.name!, weight});
      packageInfos.push(pkg);
    }
    return pkgId;
  };

  const addedIds = new Set<HoisterPackageId>();
  const addPackageToTree = (pkg: PackageInformation<NativePath>, pkgId: HoisterPackageId, parentDepIds: Set<HoisterPackageId>) => {
    addedIds.add(pkgId);
    const deps = new Set<HoisterPackageId>();
    const peerDeps = new Set<HoisterPackageId>();
    packageTree[pkgId] = {deps, peerDeps};

    for (const [name, reference] of pkg.packageDependencies) {
      if (reference) {
        const locator = typeof reference === 'string' ? {name, reference} : {name: reference[0], reference: reference[1]};
        const depPkg = pnp.getPackageInformation(locator)!;
        const depPkgId = assignPackageId(locator, depPkg);
        if (pkg.packagePeers.has(name)) {
          peerDeps.add(depPkgId);
        } else {
          deps.add(depPkgId);
        }
      }
    }

    const allDepIds = new Set([...deps, ...peerDeps]);
    for (const depId of allDepIds) {
      const depPkg = packageInfos[depId];
      if (depPkg && !addedIds.has(depId)) {
        addPackageToTree(depPkg, depId, allDepIds);
      }
    }
  };

  const pkg = pnp.getPackageInformation(pnp.topLevel)!;
  const topLocator = pnp.findPackageLocator(pkg.packageLocation)!;
  const topLocatorKey = getLocatorKey(topLocator);
  for (const locator of pnpRoots) {
    if (getLocatorKey(locator) !== topLocatorKey) {
      pkg.packageDependencies.set(locator.name!, locator.reference);
    }
  }

  const pkgId = assignPackageId(topLocator, pkg);
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
const populateNodeModulesTree = (pnp: PnpApi, hoistedTree: HoistedTree, locators: PackageLocator[], options: NodeModulesTreeOptions): NodeModulesTree => {
  const tree: NodeModulesTree = new Map();

  const makeLeafNode = (locator: PackageLocator): {target: PortablePath, linkType: LinkType} => {
    const info = pnp.getPackageInformation(locator)!;
    const truePath = (!options.pnpifyFs && pnp.resolveVirtual && locator.reference && locator.reference.startsWith('virtual:')) ? pnp.resolveVirtual(info.packageLocation) : info.packageLocation;
    return {target: npath.toPortablePath(truePath || info.packageLocation), linkType: info.linkType};
  };

  const getPackageName = (locator: PackageLocator): { name: Filename, scope: Filename | null } => {
    const [nameOrScope, name] = locator.name!.split('/');
    return name ? {scope: toFilename(nameOrScope), name: toFilename(name)} : {scope: null, name: toFilename(nameOrScope)};
  };

  const seenPkgIds = new Set();
  const buildTree = (nodeId: HoisterPackageId, prefix: PortablePath) => {
    seenPkgIds.add(nodeId);

    for (const depId of hoistedTree[nodeId]) {
      if (seenPkgIds.has(depId))
        continue;

      const locator = locators[depId];
      const {name, scope} = getPackageName(locator);

      const packageNameParts = scope ? [scope, name] : [name];
      const nodeModulesDirPath = ppath.join(prefix, NODE_MODULES);
      const depPrefix = ppath.join(nodeModulesDirPath, ...packageNameParts);

      tree.set(depPrefix, makeLeafNode(locator));

      const segments = depPrefix.split('/');
      const nodeModulesIdx = segments.indexOf(NODE_MODULES);

      let segCount = segments.length - 1;
      while (nodeModulesIdx >= 0 && segCount > nodeModulesIdx) {
        const dirPath = npath.toPortablePath(segments.slice(0, segCount).join(ppath.sep));
        const targetDir = toFilename(segments[segCount]);

        const subdirs = tree.get(dirPath);
        if (!subdirs) {
          tree.set(dirPath, {dirList: new Set([targetDir])});
        } else if (subdirs instanceof Set) {
          if (subdirs.has(targetDir)) {
            break;
          } else {
            subdirs.add(targetDir);
          }
        }

        segCount--;
      }
      buildTree(depId, depPrefix);
    }
  };

  const rootNode = makeLeafNode(locators[0]);
  const rootPrefix = rootNode.target && rootNode.target;
  buildTree(0, rootPrefix);

  if (options.pnpifyFs) {
    for (const [key, val] of tree.entries()) {
      if (val instanceof Array && val[1] === LinkType.HARD) {
        const nodeModulesDir = ppath.join(key, NODE_MODULES);
        if (tree.has(nodeModulesDir)) {
          tree.set(ppath.join(val[0], NODE_MODULES), {target: nodeModulesDir, linkType: LinkType.SOFT});
        }
      }
    }
  }

  return tree;
};
