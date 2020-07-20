import {structUtils}                                        from '@yarnpkg/core';
import {NativePath, PortablePath, Filename}                 from '@yarnpkg/fslib';
import {toFilename, npath, ppath}                           from '@yarnpkg/fslib';
import {PnpApi, PhysicalPackageLocator, PackageInformation} from '@yarnpkg/pnp';

import {hoist, HoisterTree, HoisterResult}                  from './hoist';

// Babel doesn't support const enums, thats why we use non-const enum for LinkType in @yarnpkg/pnp
// But because of this TypeScript requires @yarnpkg/pnp during runtime
// To prevent this we redeclare LinkType enum here, to not depend on @yarnpkg/pnp during runtime
export enum LinkType {HARD = `HARD`, SOFT = `SOFT`}

// The list of directories stored within a node_modules (or node_modules/@foo)
export type NodeModulesBaseNode = {
  dirList: Set<Filename>
};

// The entry for a package within a node_modules
export type NodeModulesPackageNode = {
  locator: LocatorKey,
  // The source path. Note that the virtual paths have been resolved/lost!
  target: PortablePath,
  // Hard links are copies of the target; soft links are symlinks to it
  linkType: LinkType,
  // Contains ["node_modules"] if there's nested n_m entries
  dirList?: undefined,
  aliases: Array<string>,
};

/**
 * Node modules tree - a map of every folder within the node_modules, along with their
 * directory listing and whether they are a symlink and their location.
 *
 * Sample contents:
 * /home/user/project/node_modules -> {dirList: ['foo', 'bar']}
 * /home/user/project/node_modules/foo -> {target: '/home/user/project/.yarn/.cache/foo.zip/node_modules/foo', linkType: 'HARD'}
 * /home/user/project/node_modules/bar -> {target: '/home/user/project/packages/bar', linkType: 'SOFT'}
 */
export type NodeModulesTree = Map<PortablePath, NodeModulesBaseNode | NodeModulesPackageNode>;

export interface NodeModulesTreeOptions {
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
export const getArchivePath = (packagePath: PortablePath): PortablePath | null =>
  packagePath.indexOf(`.zip/${NODE_MODULES}/`) >= 0 ?
    npath.toPortablePath(packagePath.split(`/${NODE_MODULES}/`)[0]) :
    null;

/**
 * Retrieve full package list and build hoisted `node_modules` directories
 * representation in-memory.
 *
 * @param pnp PnP API
 *
 * @returns hoisted `node_modules` directories representation in-memory
 */
export const buildNodeModulesTree = (pnp: PnpApi, options: NodeModulesTreeOptions): NodeModulesTree => {
  const packageTree = buildPackageTree(pnp, options);
  const hoistedTree = hoist(packageTree);

  return populateNodeModulesTree(pnp, hoistedTree, options);
};

const stringifyLocator = (locator: PhysicalPackageLocator): LocatorKey => `${locator.name}@${locator.reference}`;

export type NodeModulesLocatorMap = Map<LocatorKey, {
  target: PortablePath;
  linkType: LinkType;
  locations: Array<PortablePath>;
  aliases: Array<string>;
}>

export const buildLocatorMap = (nodeModulesTree: NodeModulesTree): NodeModulesLocatorMap => {
  const map = new Map();

  for (const [location, val] of nodeModulesTree.entries()) {
    if (!val.dirList) {
      let entry = map.get(val.locator);
      if (!entry) {
        entry = {target: val.target, linkType: val.linkType, locations: [], aliases: val.aliases};
        map.set(val.locator, entry);
      }

      entry.locations.push(location);
    }
  }

  for (const val of map.values()) {
    // Sort locations by depth first and then alphabetically for determinism
    val.locations = val.locations.sort((loc1: PortablePath, loc2: PortablePath) => {
      const len1 = loc1.split(ppath.delimiter).length;
      const len2 = loc2.split(ppath.delimiter).length;
      return len1 !== len2 ? len2 - len1: loc2.localeCompare(loc1);
    });
  }

  return map;
};

function isPortalLocator(locatorKey: LocatorKey): boolean {
  let descriptor = structUtils.parseDescriptor(locatorKey);
  if (structUtils.isVirtualDescriptor(descriptor))
    descriptor = structUtils.devirtualizeDescriptor(descriptor);

  return descriptor.range.startsWith(`portal:`);
}

/**
 * Traverses PnP tree and produces input for the `RawHoister`
 *
 * @param pnp PnP API
 *
 * @returns package tree, packages info and locators
 */
const buildPackageTree = (pnp: PnpApi, options: NodeModulesTreeOptions): HoisterTree => {
  const pnpRoots = pnp.getDependencyTreeRoots();

  const topPkg = pnp.getPackageInformation(pnp.topLevel);
  if (topPkg === null)
    throw new Error(`Assertion failed: Expected the top-level package to have been registered`);

  const topLocator = pnp.findPackageLocator(topPkg.packageLocation!);
  if (topLocator === null)
    throw new Error(`Assertion failed: Expected the top-level package to have a physical locator`);

  for (const locator of pnpRoots) {
    if (locator.name !== topLocator.name || locator.reference !== topLocator.reference) {
      topPkg.packageDependencies.set(`${locator.name}$wsroot$`, locator.reference);
    }
  }

  const packageTree: HoisterTree = {
    name: topLocator.name,
    identName: topLocator.name,
    reference: topLocator.reference,
    peerNames: topPkg.packagePeers,
    dependencies: new Set<HoisterTree>(),
  };

  const nodes = new Map<string, HoisterTree>();
  const getNodeKey = (name: string, locator: PhysicalPackageLocator) => `${stringifyLocator(locator)}:${name}`;

  const addPackageToTree = (name: string, pkg: PackageInformation<NativePath>, locator: PhysicalPackageLocator, parent: HoisterTree, parentPkg: PackageInformation<NativePath>) => {
    const nodeKey = getNodeKey(name, locator);
    let node = nodes.get(nodeKey);

    const isSeen = !!node;
    if (!isSeen && locator.name === topLocator.name && locator.reference === topLocator.reference) {
      node = packageTree;
      nodes.set(nodeKey, packageTree);
    }

    if (!node) {
      node = {
        name,
        identName: locator.name,
        reference: locator.reference,
        dependencies: new Set(),
        peerNames: pkg.packagePeers,
      };

      nodes.set(nodeKey, node);
    }

    parent.dependencies.add(node);

    // If we link dependencies to file system we must not try to install children dependencies inside portal folders
    const shouldAddChildrenDependencies = options.pnpifyFs || !isPortalLocator(nodeKey);

    if (!isSeen && shouldAddChildrenDependencies) {
      for (const [name, referencish] of pkg.packageDependencies) {
        if (referencish !== null && !node.peerNames.has(name)) {
          const depLocator = pnp.getLocator(name, referencish);
          const pkgLocator = pnp.getLocator(name.replace(`$wsroot$`, ``), referencish);

          const depPkg = pnp.getPackageInformation(pkgLocator);
          if (depPkg === null)
            throw new Error(`Assertion failed: Expected the package to have been registered`);

          // Skip package self-references
          if (depLocator.name === locator.name && depLocator.reference === locator.reference)
            continue;

          addPackageToTree(name, depPkg, depLocator, node, pkg);
        }
      }
    }
  };

  addPackageToTree(topLocator.name, topPkg, topLocator, packageTree, topPkg);

  return packageTree;
};

function getTargetLocatorPath(locator: PhysicalPackageLocator, pnp: PnpApi, options: NodeModulesTreeOptions): {linkType: LinkType, target: PortablePath} {
  const pkgLocator = pnp.getLocator(locator.name.replace(`$wsroot$`, ``), locator.reference);

  const info = pnp.getPackageInformation(pkgLocator);
  if (info === null)
    throw new Error(`Assertion failed: Expected the package to be registered`);

  let linkType;
  let target;
  if (options.pnpifyFs) {
    // In case of pnpifyFs we represent modules as symlinks to archives in NodeModulesFS
    // `/home/user/project/foo` is a symlink to `/home/user/project/.yarn/.cache/foo.zip/node_modules/foo`
    // To make this fs layout work with legacy tools we make
    // `/home/user/project/.yarn/.cache/foo.zip/node_modules/foo/node_modules` (which normally does not exist inside archive) a symlink to:
    // `/home/user/project/node_modules/foo/node_modules`, so that the tools were able to access it
    target = npath.toPortablePath(info.packageLocation);
    linkType = LinkType.SOFT;
  } else {
    const truePath = pnp.resolveVirtual && locator.reference && locator.reference.startsWith(`virtual:`)
      ? pnp.resolveVirtual(info.packageLocation)
      : info.packageLocation;

    target = npath.toPortablePath(truePath || info.packageLocation);
    linkType = info.linkType;
  }
  return {linkType, target};
}

/**
 * Converts hoisted tree to node modules map
 *
 * @param pnp PnP API
 * @param hoistedTree hoisted package tree from `RawHoister`
 * @param locators locators
 * @param packages package weights
 *
 * @returns node modules map
 */
const populateNodeModulesTree = (pnp: PnpApi, hoistedTree: HoisterResult, options: NodeModulesTreeOptions): NodeModulesTree => {
  const tree: NodeModulesTree = new Map();

  const makeLeafNode = (locator: PhysicalPackageLocator, aliases: Array<string>): {locator: LocatorKey, target: PortablePath, linkType: LinkType, aliases: Array<string>} => {
    const {linkType, target} = getTargetLocatorPath(locator, pnp, options);

    return {
      locator: stringifyLocator(locator),
      target,
      linkType,
      aliases,
    };
  };

  const getPackageName = (identName: string): { name: Filename, scope: Filename | null } => {
    const [nameOrScope, name] = identName.split(`/`);

    return name ? {
      scope: toFilename(nameOrScope),
      name: toFilename(name),
    } : {
      scope: null,
      name: toFilename(nameOrScope),
    };
  };

  const seenNodes = new Set<HoisterResult>();
  const buildTree = (pkg: HoisterResult, locationPrefix: PortablePath) => {
    if (seenNodes.has(pkg))
      return;

    seenNodes.add(pkg);

    for (const dep of pkg.dependencies) {
      // We do not want self-references in node_modules, since they confuse existing tools
      if (dep === pkg)
        continue;
      const references = Array.from(dep.references).sort();
      const locator = {name: dep.identName, reference: references[0]};
      const {name, scope} = getPackageName(dep.name);

      const packageNameParts = scope
        ? [scope, name]
        : [name];

      const nodeModulesDirPath = ppath.join(locationPrefix, NODE_MODULES);
      const nodeModulesLocation = ppath.join(nodeModulesDirPath, ...packageNameParts);

      const leafNode = makeLeafNode(locator, references.slice(1));
      if (!dep.name.endsWith(`$wsroot$`)) {
        const prevNode = tree.get(nodeModulesLocation);
        if (prevNode) {
          if (prevNode.dirList) {
            throw new Error(`Assertion failed: ${nodeModulesLocation} cannot merge dir node with leaf node`);
          } else {
            const locator1 = structUtils.parseLocator(prevNode.locator);
            const locator2 = structUtils.parseLocator(leafNode.locator);

            if (prevNode.linkType !== leafNode.linkType)
              throw new Error(`Assertion failed: ${nodeModulesLocation} cannot merge nodes with different link types`);
            else if (locator1.identHash !== locator2.identHash)
              throw new Error(`Assertion failed: ${nodeModulesLocation} cannot merge nodes with different idents ${structUtils.stringifyLocator(locator1)} and ${structUtils.stringifyLocator(locator2)}`);

            leafNode.aliases = [...leafNode.aliases, ...prevNode.aliases, structUtils.parseLocator(prevNode.locator).reference];
          }
        }

        tree.set(nodeModulesLocation, leafNode);

        const segments = nodeModulesLocation.split(`/`);
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
      }

      buildTree(dep, leafNode.linkType === LinkType.SOFT ? leafNode.target : nodeModulesLocation);
    }
  };

  const rootNode = makeLeafNode({name: hoistedTree.name, reference: Array.from(hoistedTree.references)[0] as string}, []);
  const rootPath = rootNode.target;
  tree.set(rootPath, rootNode);
  buildTree(hoistedTree, rootPath);

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
const benchmarkRawHoisting = (packageTree: HoisterTree) => {
  const iterCount = 10;
  const startTime = Date.now();
  for (let iter = 0; iter < iterCount; iter++)
    hoist(packageTree);
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
    const packageTree = buildPackageTree(pnp, options);
    const hoistedTree = hoist(packageTree);
    populateNodeModulesTree(pnp, hoistedTree, options);
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
  const dumpTree = (nodePath: PortablePath, prefix: string = ``, dirPrefix = ``): string => {
    const node = sortedTree.get(nodePath);
    if (!node)
      return ``;
    seenPaths.add(nodePath);
    let str = ``;
    if (node.dirList) {
      const dirs = Array.from(node.dirList);
      for (let idx = 0; idx < dirs.length; idx++) {
        const dir = dirs[idx];
        str += `${prefix}${idx < dirs.length - 1 ? `├─` : `└─`}${dirPrefix}${dir}\n`;
        str += dumpTree(ppath.join(nodePath, dir), `${prefix}${idx < dirs.length - 1 ?`│ ` : `  `}`);
      }
    } else {
      const {target, linkType} = node;
      str += dumpTree(ppath.join(nodePath, NODE_MODULES), `${prefix}│ `, `${NODE_MODULES}/`);
      str += `${prefix}└─${linkType === LinkType.SOFT ? `s>` : `>`}${target}\n`;
    }
    return str;
  };

  let str = dumpTree(ppath.join(rootPath, NODE_MODULES));
  for (const key of sortedTree.keys()) {
    if (!seenPaths.has(key)) {
      str += `${key.replace(rootPath, ``)}\n${dumpTree(key)}`;
    }
  }
  return str;
};

/**
 * Pretty-prints dependency tree in the `yarn why`-like format
 *
 * The function is used for troubleshooting purposes only.
 *
 * @param pkg node_modules tree
 *
 * @returns sorted node_modules tree
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const dumpDepTree = (tree: HoisterResult) => {
  const dumpLocator = (locator: PhysicalPackageLocator): string => {
    if (locator.reference === `workspace:.`) {
      return `.`;
    } else if (!locator.reference) {
      return `${locator.name}@${locator.reference}`;
    } else {
      const version = (locator.reference.indexOf(`#`) > 0 ? locator.reference.split(`#`)[1] : locator.reference).replace(`npm:`, ``);
      if (locator.reference.startsWith(`virtual`)) {
        return `v:${locator.name}@${version}`;
      } else {
        return `${locator.name}@${version}`;
      }
    }
  };

  const dumpPackage = (pkg: HoisterResult, parents: Array<HoisterResult>, prefix = ``): string => {
    if (parents.includes(pkg))
      return ``;

    const dependencies = Array.from(pkg.dependencies);

    let str = ``;
    for (let idx = 0; idx < dependencies.length; idx++) {
      const dep = dependencies[idx];
      str += `${prefix}${idx < dependencies.length - 1 ? `├─` : `└─`}${(parents.includes(dep) ? `>` : ``) + dumpLocator({name: dep.name, reference: Array.from(dep.references)[0]})}\n`;
      str += dumpPackage(dep, [...parents, dep], `${prefix}${idx < dependencies.length - 1 ?`│ ` : `  `}`);
    }
    return str;
  };

  return dumpPackage(tree, []);
};
