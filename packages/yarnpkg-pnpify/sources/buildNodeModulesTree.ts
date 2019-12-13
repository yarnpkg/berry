import {NativePath, PortablePath, Filename, toFilename, npath, ppath, xfs}                                    from '@yarnpkg/fslib';
import {PnpApi, PackageLocator, PackageInformation}                                                           from '@yarnpkg/pnp';

import {hoist, ReadonlyHoisterPackageTree, HoisterPackageId, HoisterPackageInfo, ReadonlyHoisterDependencies} from './hoist';
import {HoistedTree, HoisterPackageTree}                                                                      from './hoist';


// Babel doesn't support const enums, thats why we use non-const enum for LinkType in @yarnpkg/pnp
// But because of this TypeScript requires @yarnpkg/pnp during runtime
// To prevent this we redeclare LinkType enum here, to not depend on @yarnpkg/pnp during runtime
export enum LinkType {HARD = 'HARD', SOFT = 'SOFT'};

/**
 * Node modules tree - a map of every folder within the node_modules, along with their
 * directory listing and whether they are a symlink and their location.
 *
 * Sample contents:
 * /home/user/project/node_modules -> {dirList: ['foo', 'bar']}
 * /home/user/project/node_modules/foo -> {target: '/home/user/project/.yarn/.cache/foo.zip/node_modules/foo', linkType: 'HARD'}
 * /home/user/project/node_modules/bar -> {target: '/home/user/project/packages/bar', linkType: 'SOFT'}
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
 * Returns path to archive, if package location is inside the archive.
 *
 * @param packagePath package location
 *
 * @returns path to archive is location is insde the archive or null otherwise
 */
const getArchivePath = (packagePath: PortablePath): PortablePath | null =>
  packagePath.indexOf(`.zip/${NODE_MODULES}/`) >= 0 ?
    npath.toPortablePath(packagePath.split(`/${NODE_MODULES}/`)[0]) :
    null;

/**
 * Determines package's weight relative to other packages for hoisting purposes.
 * If optimizeSizeOnDisk is `true`, we use archive size in bytes as a weight,
 * otherwise weight 1 is assigned to each package.
 *
 * @param packagePath package path
 * @param optimizeSizeOnDisk whether size on disk should be optimized during hoisting
 */
const getPackageWeight = (packagePath: PortablePath, {optimizeSizeOnDisk}: NodeModulesTreeOptions) => {
  if (!optimizeSizeOnDisk)
    return 1;

  const archivePath = getArchivePath(packagePath);
  if (archivePath === null)
    return 1;

  return xfs.statSync(archivePath).size;
};

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
    const pkgId = locatorToPackageMap.get(locatorKey);
    if (typeof pkgId !== 'undefined')
      return pkgId;

    const newPkgId = lastPkgId++;
    const packagePath = npath.toPortablePath(pkg.packageLocation);
    const weight = getPackageWeight(packagePath, options);

    locatorToPackageMap.set(locatorKey, newPkgId);
    locators.push(locator);
    packages.push({name: locator.name!, weight});
    packageInfos.push(pkg);
    return newPkgId;
  };

  const addedIds = new Set<HoisterPackageId>();
  const addPackageToTree = (pkg: PackageInformation<NativePath>, pkgId: HoisterPackageId, parentDepIds: Set<HoisterPackageId>) => {
    if (addedIds.has(pkgId))
      return;
    addedIds.add(pkgId);
    const deps = new Set<HoisterPackageId>();
    const peerDeps = new Set<HoisterPackageId>();
    packageTree[pkgId] = {deps, peerDeps};

    for (const [name, referencish] of pkg.packageDependencies) {
      if (referencish !== null) {
        const locator = pnp.getLocator(name, referencish);
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
      addPackageToTree(depPkg, depId, allDepIds);
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
    if (options.pnpifyFs) {
      return {target: npath.toPortablePath(info.packageLocation), linkType: LinkType.SOFT};
    } else {
      const truePath = pnp.resolveVirtual && locator.reference && locator.reference.startsWith('virtual:') ? pnp.resolveVirtual(info.packageLocation) : info.packageLocation;
      return {target: npath.toPortablePath(truePath || info.packageLocation), linkType: info.linkType};
    }
  };

  const getPackageName = (locator: PackageLocator): { name: Filename, scope: Filename | null } => {
    const [nameOrScope, name] = locator.name!.split('/');
    return name ? {scope: toFilename(nameOrScope), name: toFilename(name)} : {scope: null, name: toFilename(nameOrScope)};
  };

  const seenPkgIds = new Set();
  const buildTree = (nodeId: HoisterPackageId, locationPrefix: PortablePath) => {
    if (seenPkgIds.has(nodeId))
      return;
    seenPkgIds.add(nodeId);

    for (const depId of hoistedTree[nodeId]) {
      const locator = locators[depId];
      const {name, scope} = getPackageName(locator);

      const packageNameParts = scope ? [scope, name] : [name];

      const nodeModulesDirPath = ppath.join(locationPrefix, NODE_MODULES);
      const nodeModulesLocation = ppath.join(nodeModulesDirPath, ...packageNameParts);

      const leafNode = makeLeafNode(locator);
      tree.set(nodeModulesLocation, leafNode);

      const segments = nodeModulesLocation.split('/');
      const nodeModulesIdx = segments.indexOf(NODE_MODULES);

      let segCount = segments.length - 1;
      while (nodeModulesIdx >= 0 && segCount > nodeModulesIdx) {
        const dirPath = npath.toPortablePath(segments.slice(0, segCount).join(ppath.sep));
        const targetDir = toFilename(segments[segCount]);

        const subdirs = tree.get(dirPath);
        if (!subdirs) {
          tree.set(dirPath, {dirList: new Set([targetDir])});
        } else if (subdirs.dirList) {
          if (subdirs.dirList.has(targetDir)) {
            break;
          } else {
            subdirs.dirList.add(targetDir);
          }
        }

        segCount--;
      }

      // In case of pnpifyFs we represent modules as symlinks to archives in NodeModulesFS
      // `/home/user/project/foo` is a symlink to `/home/user/project/.yarn/.cache/foo.zip/node_modules/foo`
      // To make this fs layout work with legacy tools we make
      // `/home/user/project/.yarn/.cache/foo.zip/node_modules/foo/node_modules` (which normally does not exist inside archive) a symlink to:
      // `/home/user/project/node_modules/foo/node_modules`, so that the tools were able to access it
      buildTree(depId, options.pnpifyFs ? leafNode.target: nodeModulesLocation);
    }
  };

  const rootNode = makeLeafNode(locators[0]);
  const rootPath = rootNode.target && rootNode.target;
  buildTree(0, rootPath);

  return tree;
};

/**
 * Benchmarks raw hoisting performance.
 *
 * The function is used for troubleshooting purposes only.
 *
 * @param packageTree package tree
 * @param packages package info
 *
 * @returns average raw hoisting time
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const benchmarkRawHoisting = (packageTree: ReadonlyHoisterPackageTree, packages: HoisterPackageInfo[]) => {
  const iterCount = 100;
  const startTime = Date.now();
  for (let iter = 0; iter < iterCount; iter++)
    hoist(packageTree, packages);
  const endTime = Date.now();
  return (endTime - startTime) / iterCount;
};

/**
 * Benchmarks node_modules tree building.
 *
 * The function is used for troubleshooting purposes only.
 *
 * @param packageTree package tree
 * @param packages package info
 *
 * @returns average raw hoisting time
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const benchmarkBuildTree = (pnp: PnpApi, options: NodeModulesTreeOptions): number => {
  const iterCount = 100;
  const startTime = Date.now();
  for (let iter = 0; iter < iterCount; iter++) {
    const {packageTree, packages, locators} = buildPackageTree(pnp, options);
    const hoistedTree = hoist(packageTree, packages);
    populateNodeModulesTree(pnp, hoistedTree, locators, options);
  }
  const endTime = Date.now();
  return (endTime - startTime) / iterCount;
};

/**
 * Pretty-prints node_modules tree.
 *
 * The function is used for troubleshooting purposes only.
 *
 * @param tree node_modules tree
 * @param rootPath top-level project root folder
 *
 * @returns sorted node_modules tree
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const dumpNodeModulesTree = (tree: NodeModulesTree, rootPath: PortablePath): string => {
  const sortedTree: NodeModulesTree = new Map();

  const keys = Array.from(tree.keys()).sort();
  for (const key of keys) {
    const val = tree.get(key)!;
    sortedTree.set(key, val.dirList ? {dirList: new Set(Array.from(val.dirList).sort())} : val);
  }

  const seenPaths = new Set();
  const dumpTree = (nodePath: PortablePath, prefix: string = '', dirPrefix = ''): string => {
    const node = sortedTree.get(nodePath);
    if (!node)
      return '';
    seenPaths.add(nodePath);
    let str = '';
    if (node.dirList) {
      const dirs = Array.from(node.dirList);
      for (let idx = 0; idx < dirs.length; idx++) {
        const dir = dirs[idx];
        str += `${prefix}${idx < dirs.length - 1 ? '├─' : '└─'}${dirPrefix}${dir}\n`;
        str += dumpTree(ppath.join(nodePath, dir), `${prefix}${idx < dirs.length - 1 ?'│ ' : '  '}`);
      }
    } else {
      const {target, linkType} = node;
      str += dumpTree(ppath.join(nodePath, NODE_MODULES), `${prefix}│ `, `${NODE_MODULES}/`);
      str += `${prefix}└─${linkType === LinkType.SOFT ? 's>' : '>'}${target}\n`;
    }
    return str;
  };

  let str = dumpTree(ppath.join(rootPath, NODE_MODULES));
  for (const key of sortedTree.keys()) {
    if (!seenPaths.has(key)) {
      str += `${key.replace(rootPath, '')}\n${dumpTree(key)}`;
    }
  }
  return str;
};

/**
 * Pretty-prints dependency tree in the `yarn why`-like format
 *
 * The function is used for troubleshooting purposes only.
 *
 * @param tree node_modules tree
 *
 * @returns sorted node_modules tree
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const dumpDepTree = (tree: ReadonlyHoisterPackageTree | HoistedTree, locators: PackageLocator[], nodeId: number = 0, prefix = '', seenIds = new Set()) => {
  if (seenIds.has(nodeId))
    return '';
  seenIds.add(nodeId);

  const dumpLocator = (locator: PackageLocator): string => {
    if (locator.reference === 'workspace:.') {
      return '.';
    } else if (!locator.reference) {
      return `${locator.name!}@${locator.reference}`;
    } else {
      const version = (locator.reference.indexOf('#') > 0 ? locator.reference.split('#')[1] : locator.reference).replace('npm:', '');
      if (locator.reference.startsWith('virtual')) {
        return `v:${locator.name!}@${version}`;
      } else {
        return `${locator.name!}@${version}`;
      }
    }
  };

  const deps: number[] = Array.from(((tree[nodeId] as ReadonlyHoisterDependencies).deps || tree[nodeId]));

  const traverseIds = new Set();
  for (const depId of deps) {
    if (!seenIds.has(depId)) {
      traverseIds.add(depId);
      seenIds.add(depId);
    }
  }

  let str = '';
  for (let idx = 0; idx < deps.length; idx++) {
    const depId = deps[idx];
    str += `${prefix}${idx < deps.length - 1 ? '├─' : '└─'}${(traverseIds.has(depId) ? '>' : '') + dumpLocator(locators[depId])}\n`;
    if (traverseIds.has(depId)) {
      seenIds.delete(depId);
      str += dumpDepTree(tree, locators, depId, `${prefix}${idx < deps.length - 1 ?'│ ' : '  '}`, seenIds);
      seenIds.add(depId);
    }
  }
  for (const depId of traverseIds)
    seenIds.delete(depId);
  return str;
};
