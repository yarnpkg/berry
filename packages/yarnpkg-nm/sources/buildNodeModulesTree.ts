import {structUtils, Project, MessageName, Locator}                           from '@yarnpkg/core';
import {toFilename, npath, ppath}                                             from '@yarnpkg/fslib';
import {NativePath, PortablePath, Filename}                                   from '@yarnpkg/fslib';
import {PnpApi, PhysicalPackageLocator, PackageInformation, DependencyTarget} from '@yarnpkg/pnp';

import {hoist, HoisterTree, HoisterResult, HoisterDependencyKind}             from './hoist';

// Babel doesn't support const enums, thats why we use non-const enum for LinkType in @yarnpkg/pnp
// But because of this TypeScript requires @yarnpkg/pnp during runtime
// To prevent this we redeclare LinkType enum here, to not depend on @yarnpkg/pnp during runtime
export enum LinkType {
  HARD = `HARD`,
  SOFT = `SOFT`,
}

export enum NodeModulesHoistingLimits {
  WORKSPACES = `workspaces`,
  DEPENDENCIES = `dependencies`,
  NONE = `none`,
}

// The list of directories stored within a node_modules (or node_modules/@foo)
export type NodeModulesBaseNode = {
  dirList: Set<Filename>;
};

// The entry for a package within a node_modules
export type NodeModulesPackageNode = {
  locator: LocatorKey;
  // The source path. Note that the virtual paths have been resolved/lost!
  target: PortablePath;
  // Hard links are copies of the target; soft links are symlinks to it
  linkType: LinkType;
  // Contains ["node_modules"] if there's nested n_m entries
  dirList?: undefined;
  nodePath: string;
  aliases: Array<string>;
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
export type NodeModulesTreeErrors = Array<{messageName: MessageName, text: string}>;

export interface NodeModulesTreeOptions {
  pnpifyFs?: boolean;
  validateExternalSoftLinks?: boolean;
  hoistingLimitsByCwd?: Map<PortablePath, NodeModulesHoistingLimits>;
  selfReferencesByCwd?: Map<PortablePath, Boolean>;
  project?: Project;
}

/** node_modules path segment */
const NODE_MODULES = `node_modules` as Filename;

/**
 * The workspace name suffix used internally by this implementation and appeneded to the name of workspace package.
 * It is needed to create and distinguuish special nodes for workspaces
 */
const WORKSPACE_NAME_SUFFIX = `$wsroot$`;

/** Package locator key for usage inside maps */
type LocatorKey = string;

type WorkspaceTree = {workspaceLocator?: PhysicalPackageLocator, children: Map<Filename, WorkspaceTree>};

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
export const buildNodeModulesTree = (pnp: PnpApi, options: NodeModulesTreeOptions): {tree: NodeModulesTree | null, errors: NodeModulesTreeErrors, preserveSymlinksRequired: boolean} => {
  const {packageTree, hoistingLimits, errors, preserveSymlinksRequired} = buildPackageTree(pnp, options);

  let tree: NodeModulesTree | null = null;
  if (errors.length === 0) {
    const hoistedTree = hoist(packageTree, {hoistingLimits});

    tree = populateNodeModulesTree(pnp, hoistedTree, options);
  }

  return {tree, errors, preserveSymlinksRequired};
};

const stringifyLocator = (locator: PhysicalPackageLocator): LocatorKey => `${locator.name}@${locator.reference}`;

export type NodeModulesLocatorMap = Map<LocatorKey, {
  target: PortablePath;
  linkType: LinkType;
  locations: Array<PortablePath>;
  aliases: Array<string>;
}>;

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
      if (loc2 === loc1) {
        return 0;
      } else if (len1 !== len2) {
        return len2 - len1;
      } else {
        return loc2 > loc1 ? 1 : -1;
      }
    });
  }

  return map;
};

const areRealLocatorsEqual = (a: Locator, b: Locator) => {
  const realA = structUtils.isVirtualLocator(a) ? structUtils.devirtualizeLocator(a) : a;
  const realB = structUtils.isVirtualLocator(b) ? structUtils.devirtualizeLocator(b) : b;
  return structUtils.areLocatorsEqual(realA, realB);
};

type WorkspaceMap = Map<LocatorKey, Set<PhysicalPackageLocator>>;

const isExternalSoftLink = (pkg: PackageInformation<NativePath>, locator: PhysicalPackageLocator, pnp: PnpApi, topPkgPortableLocation: PortablePath) => {
  if (pkg.linkType !== LinkType.SOFT)
    return false;

  const realSoftLinkPath = npath.toPortablePath(pnp.resolveVirtual && locator.reference && locator.reference.startsWith(`virtual:`) ? pnp.resolveVirtual(pkg.packageLocation)! : pkg.packageLocation);
  return ppath.contains(topPkgPortableLocation, realSoftLinkPath) === null;
};

/**
 * Builds a map representing layout of nested workspaces and internal portals on the file system.
 */
const buildWorkspaceMap = (pnp: PnpApi): WorkspaceMap => {
  const topPkg = pnp.getPackageInformation(pnp.topLevel);
  if (topPkg === null)
    throw new Error(`Assertion failed: Expected the top-level package to have been registered`);

  const topLocator = pnp.findPackageLocator(topPkg.packageLocation!);
  if (topLocator === null)
    throw new Error(`Assertion failed: Expected the top-level package to have a physical locator`);

  const topPkgPortableLocation = npath.toPortablePath(topPkg.packageLocation.slice(0, -1));
  const workspaceMap = new Map<LocatorKey, Set<PhysicalPackageLocator>>();

  const workspaceTree: WorkspaceTree = {children: new Map()};
  const pnpRoots = pnp.getDependencyTreeRoots();
  // Workspace and internal portal locations to locators map
  const workspaceLikeLocators = new Map<PortablePath, PhysicalPackageLocator>();

  const seen = new Set();
  const visit = (locator: PhysicalPackageLocator, parentLocator: PhysicalPackageLocator | null) => {
    const locatorKey = stringifyLocator(locator);
    if (seen.has(locatorKey))
      return;

    seen.add(locatorKey);

    const pkg = pnp.getPackageInformation(locator);
    if (pkg) {
      const parentLocatorKey = parentLocator ? stringifyLocator(parentLocator) : ``;
      if (stringifyLocator(locator) !== parentLocatorKey && pkg.linkType === LinkType.SOFT && !isExternalSoftLink(pkg, locator, pnp, topPkgPortableLocation)) {
        const location = getRealPackageLocation(pkg, locator, pnp);
        const prevLocator = workspaceLikeLocators.get(location);
        // Give workspaces a priority over portals and other protocols pointing to the same location
        // The devDependencies are not installed for portals, but installed for workspaces
        if (!prevLocator || locator.reference.startsWith(`workspace:`)) {
          workspaceLikeLocators.set(location, locator);
        }
      }

      for (const [name, referencish] of pkg.packageDependencies) {
        if (referencish !== null) {
          if (!pkg.packagePeers.has(name)) {
            visit(pnp.getLocator(name, referencish), locator);
          }
        }
      }
    }
  };

  for (const locator of pnpRoots)
    visit(locator, null);

  const cwdSegments = topPkgPortableLocation.split(ppath.sep);
  for (const locator of workspaceLikeLocators.values()) {
    const pkg = pnp.getPackageInformation(locator)!;
    const location = npath.toPortablePath(pkg.packageLocation.slice(0, -1));
    const segments = location.split(ppath.sep).slice(cwdSegments.length);
    let node = workspaceTree;
    for (const segment of segments) {
      let nextNode = node.children.get(segment as Filename);
      if (!nextNode) {
        nextNode = {children: new Map()};
        node.children.set(segment as Filename, nextNode);
      }
      node = nextNode;
    }
    node.workspaceLocator = locator;
  }

  const addWorkspace = (node: WorkspaceTree, parentWorkspaceLocator: PhysicalPackageLocator) => {
    if (node.workspaceLocator) {
      const parentLocatorKey = stringifyLocator(parentWorkspaceLocator);
      let dependencies = workspaceMap.get(parentLocatorKey);
      if (!dependencies) {
        dependencies = new Set();
        workspaceMap.set(parentLocatorKey, dependencies);
      }
      dependencies.add(node.workspaceLocator);
    }
    for (const child of node.children.values()) {
      addWorkspace(child, node.workspaceLocator || parentWorkspaceLocator);
    }
  };

  for (const child of workspaceTree.children.values())
    addWorkspace(child, workspaceTree.workspaceLocator!);

  return workspaceMap;
};

/**
 * Traverses PnP tree and produces input for the `RawHoister`
 *
 * @param pnp PnP API
 *
 * @returns package tree, packages info and locators
 */
const buildPackageTree = (pnp: PnpApi, options: NodeModulesTreeOptions): { packageTree: HoisterTree, hoistingLimits: Map<LocatorKey, Set<string>>, errors: NodeModulesTreeErrors, preserveSymlinksRequired: boolean } => {
  const errors: NodeModulesTreeErrors = [];
  let preserveSymlinksRequired = false;

  const hoistingLimits = new Map<LocatorKey, Set<string>>();
  const workspaceMap = buildWorkspaceMap(pnp);

  const topPkg = pnp.getPackageInformation(pnp.topLevel);
  if (topPkg === null)
    throw new Error(`Assertion failed: Expected the top-level package to have been registered`);

  const topLocator = pnp.findPackageLocator(topPkg.packageLocation!);
  if (topLocator === null)
    throw new Error(`Assertion failed: Expected the top-level package to have a physical locator`);

  const topPkgPortableLocation = npath.toPortablePath(topPkg.packageLocation.slice(0, -1));

  const packageTree: HoisterTree = {
    name: topLocator.name,
    identName: topLocator.name,
    reference: topLocator.reference,
    peerNames: topPkg.packagePeers,
    dependencies: new Set<HoisterTree>(),
    dependencyKind: HoisterDependencyKind.WORKSPACE,
  };

  const nodes = new Map<string, HoisterTree>();
  const getNodeKey = (name: string, locator: PhysicalPackageLocator) => `${stringifyLocator(locator)}:${name}`;
  const addPackageToTree = (name: string, pkg: PackageInformation<NativePath>, locator: PhysicalPackageLocator, parent: HoisterTree, parentPkg: PackageInformation<NativePath>, parentDependencies: Map<string, DependencyTarget>, parentRelativeCwd: PortablePath, isHoistBorder: boolean) => {
    const nodeKey = getNodeKey(name, locator);
    let node = nodes.get(nodeKey);

    const isSeen = !!node;
    if (!isSeen && locator.name === topLocator.name && locator.reference === topLocator.reference) {
      node = packageTree;
      nodes.set(nodeKey, packageTree);
    }

    const isExternalSoftLinkPackage = isExternalSoftLink(pkg, locator, pnp, topPkgPortableLocation);

    if (!node) {
      let dependencyKind = HoisterDependencyKind.REGULAR;
      if (isExternalSoftLinkPackage)
        dependencyKind = HoisterDependencyKind.EXTERNAL_SOFT_LINK;
      else if (pkg.linkType === LinkType.SOFT && locator.name.endsWith(WORKSPACE_NAME_SUFFIX))
        dependencyKind = HoisterDependencyKind.WORKSPACE;


      node = {
        name,
        identName: locator.name,
        reference: locator.reference,
        dependencies: new Set(),
        // View peer dependencies as regular dependencies for workspaces
        // (meeting workspace peer dependency constraints is sometimes hard, sometimes impossible for the nm linker)
        peerNames: dependencyKind === HoisterDependencyKind.WORKSPACE ? new Set() : pkg.packagePeers,
        dependencyKind,
      };

      nodes.set(nodeKey, node);
    }

    let hoistPriority;
    if (isExternalSoftLinkPackage)
      // External soft link dependencies have the highest priority - we don't want to install inside them
      hoistPriority = 2;
    else if (parentPkg.linkType === LinkType.SOFT)
      // Internal soft link dependencies should have priority over transitive dependencies - to maximize chances having only one top-level node_modules
      hoistPriority = 1;
    else
      hoistPriority = 0;
    node.hoistPriority = Math.max(node.hoistPriority || 0, hoistPriority);

    if (isHoistBorder && !isExternalSoftLinkPackage) {
      const parentLocatorKey = stringifyLocator({name: parent.identName, reference: parent.reference});
      const dependencyBorders = hoistingLimits.get(parentLocatorKey) || new Set();
      hoistingLimits.set(parentLocatorKey, dependencyBorders);
      dependencyBorders.add(node.name);
    }

    const allDependencies = new Map(pkg.packageDependencies);

    if (options.project) {
      const workspace = options.project.workspacesByCwd.get(npath.toPortablePath(pkg.packageLocation.slice(0, -1)));
      if (workspace) {
        const peerCandidates = new Set([
          ...Array.from(workspace.manifest.peerDependencies.values(), x => structUtils.stringifyIdent(x)),
          ...Array.from(workspace.manifest.peerDependenciesMeta.keys()),
        ]);
        for (const peerName of peerCandidates) {
          if (!allDependencies.has(peerName)) {
            allDependencies.set(peerName, parentDependencies.get(peerName) || null);
            node.peerNames.add(peerName);
          }
        }
      }
    }

    const locatorKey = stringifyLocator({name: locator.name.replace(WORKSPACE_NAME_SUFFIX, ``), reference: locator.reference});
    const innerWorkspaces = workspaceMap.get(locatorKey);
    if (innerWorkspaces) {
      for (const workspaceLocator of innerWorkspaces) {
        allDependencies.set(`${workspaceLocator.name}${WORKSPACE_NAME_SUFFIX}`, workspaceLocator.reference);
      }
    }

    if (pkg !== parentPkg || pkg.linkType !== LinkType.SOFT || !options.selfReferencesByCwd || options.selfReferencesByCwd.get(parentRelativeCwd))
      parent.dependencies.add(node);

    const isWorkspaceDependency = locator !== topLocator && pkg.linkType === LinkType.SOFT && !locator.name.endsWith(WORKSPACE_NAME_SUFFIX) && !isExternalSoftLinkPackage;

    if (!isSeen && !isWorkspaceDependency) {
      const siblingPortalDependencyMap = new Map<string, {target: DependencyTarget, portal: PhysicalPackageLocator}>();
      for (const [depName, referencish] of allDependencies) {
        if (referencish !== null) {
          const depLocator = pnp.getLocator(depName, referencish);
          const pkgLocator = pnp.getLocator(depName.replace(WORKSPACE_NAME_SUFFIX, ``), referencish);

          const depPkg = pnp.getPackageInformation(pkgLocator);
          if (depPkg === null)
            throw new Error(`Assertion failed: Expected the package to have been registered`);
          const isExternalSoftLinkDep = isExternalSoftLink(depPkg, depLocator, pnp, topPkgPortableLocation);

          if (options.validateExternalSoftLinks && options.project && isExternalSoftLinkDep) {
            if (depPkg.packageDependencies.size > 0)
              preserveSymlinksRequired = true;

            for (const [name, referencish] of depPkg.packageDependencies) {
              if (referencish !== null) {
                const portalDependencyLocator = structUtils.parseLocator(Array.isArray(referencish) ? `${referencish[0]}@${referencish[1]}` : `${name}@${referencish}`);
                // Ignore self-references during portal hoistability check
                if (stringifyLocator(portalDependencyLocator) !== stringifyLocator(depLocator)) {
                  const parentDependencyReferencish = allDependencies.get(name);
                  if (parentDependencyReferencish) {
                    const parentDependencyLocator = structUtils.parseLocator(Array.isArray(parentDependencyReferencish) ? `${parentDependencyReferencish[0]}@${parentDependencyReferencish[1]}` : `${name}@${parentDependencyReferencish}`);
                    if (!areRealLocatorsEqual(parentDependencyLocator, portalDependencyLocator)) {
                      errors.push({
                        messageName: MessageName.NM_CANT_INSTALL_EXTERNAL_SOFT_LINK,
                        text: `Cannot link ${structUtils.prettyIdent(options.project.configuration, structUtils.parseIdent(depLocator.name))} ` +
                        `into ${structUtils.prettyLocator(options.project.configuration, structUtils.parseLocator(`${locator.name}@${locator.reference}`))} ` +
                        `dependency ${structUtils.prettyLocator(options.project.configuration, portalDependencyLocator)} ` +
                        `conflicts with parent dependency ${structUtils.prettyLocator(options.project.configuration, parentDependencyLocator)}`,
                      });
                    }
                  } else {
                    const siblingPortalDependency = siblingPortalDependencyMap.get(name);
                    if (siblingPortalDependency) {
                      const siblingReferncish = siblingPortalDependency.target;
                      const siblingPortalDependencyLocator = structUtils.parseLocator(Array.isArray(siblingReferncish) ? `${siblingReferncish[0]}@${siblingReferncish[1]}` : `${name}@${siblingReferncish}`);
                      if (!areRealLocatorsEqual(siblingPortalDependencyLocator, portalDependencyLocator)) {
                        errors.push({
                          messageName: MessageName.NM_CANT_INSTALL_EXTERNAL_SOFT_LINK,
                          text: `Cannot link ${structUtils.prettyIdent(options.project.configuration, structUtils.parseIdent(depLocator.name))} ` +
                          `into ${structUtils.prettyLocator(options.project.configuration, structUtils.parseLocator(`${locator.name}@${locator.reference}`))} ` +
                          `dependency ${structUtils.prettyLocator(options.project.configuration, portalDependencyLocator)} ` +
                          `conflicts with dependency ${structUtils.prettyLocator(options.project.configuration, siblingPortalDependencyLocator)} ` +
                          `from sibling portal ${structUtils.prettyIdent(options.project.configuration, structUtils.parseIdent(siblingPortalDependency.portal.name))}`,
                        });
                      }
                    } else {
                      siblingPortalDependencyMap.set(name, {target: portalDependencyLocator.reference, portal: depLocator});
                    }
                  }
                }
              }
            }
          }

          const parentHoistingLimits = options.hoistingLimitsByCwd?.get(parentRelativeCwd);
          const relativeDepCwd = isExternalSoftLinkDep ? parentRelativeCwd : ppath.relative(topPkgPortableLocation, npath.toPortablePath(depPkg.packageLocation)) || PortablePath.dot;
          const depHoistingLimits = options.hoistingLimitsByCwd?.get(relativeDepCwd);
          const isHoistBorder = parentHoistingLimits === NodeModulesHoistingLimits.DEPENDENCIES
            || depHoistingLimits === NodeModulesHoistingLimits.DEPENDENCIES
            || depHoistingLimits === NodeModulesHoistingLimits.WORKSPACES;

          addPackageToTree(depName, depPkg, depLocator, node, pkg, allDependencies, relativeDepCwd, isHoistBorder);
        }
      }
    }
  };

  addPackageToTree(topLocator.name, topPkg, topLocator, packageTree, topPkg, topPkg.packageDependencies, PortablePath.dot, false);

  return {packageTree, hoistingLimits, errors, preserveSymlinksRequired};
};


function getRealPackageLocation(pkg: PackageInformation<NativePath>, locator: PhysicalPackageLocator, pnp: PnpApi): PortablePath {
  const realPath = pnp.resolveVirtual && locator.reference && locator.reference.startsWith(`virtual:`)
    ? pnp.resolveVirtual(pkg.packageLocation)
    : pkg.packageLocation;

  return npath.toPortablePath(realPath || pkg.packageLocation);
}

function getTargetLocatorPath(locator: PhysicalPackageLocator, pnp: PnpApi, options: NodeModulesTreeOptions): {linkType: LinkType, target: PortablePath} {
  const pkgLocator = pnp.getLocator(locator.name.replace(WORKSPACE_NAME_SUFFIX, ``), locator.reference);

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
    target = getRealPackageLocation(info, locator, pnp);
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

  const makeLeafNode = (locator: PhysicalPackageLocator, nodePath: string, aliases: Array<string>): {locator: LocatorKey, nodePath: string, target: PortablePath, linkType: LinkType, aliases: Array<string>} => {
    const {linkType, target} = getTargetLocatorPath(locator, pnp, options);

    return {
      locator: stringifyLocator(locator),
      nodePath,
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
  const buildTree = (pkg: HoisterResult, locationPrefix: PortablePath, parentNodePath: string) => {
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

      const nodePath = `${parentNodePath}/${locator.name}`;
      const leafNode = makeLeafNode(locator, parentNodePath, references.slice(1));

      // We don't want to create self-referencing symlinks for anonymous workspaces
      let isAnonymousWorkspace = false;
      if (leafNode.linkType === LinkType.SOFT && options.project) {
        const workspace = options.project.workspacesByCwd.get(leafNode.target.slice(0, -1) as PortablePath);
        isAnonymousWorkspace = !!(workspace && !workspace.manifest.name);
      }

      if (!dep.name.endsWith(WORKSPACE_NAME_SUFFIX) && !isAnonymousWorkspace) {
        const prevNode = tree.get(nodeModulesLocation);
        if (prevNode) {
          if (prevNode.dirList) {
            throw new Error(`Assertion failed: ${nodeModulesLocation} cannot merge dir node with leaf node`);
          } else {
            const locator1 = structUtils.parseLocator(prevNode.locator);
            const locator2 = structUtils.parseLocator(leafNode.locator);

            if (prevNode.linkType !== leafNode.linkType)
              throw new Error(`Assertion failed: ${nodeModulesLocation} cannot merge nodes with different link types ${prevNode.nodePath}/${structUtils.stringifyLocator(locator1)} and ${parentNodePath}/${structUtils.stringifyLocator(locator2)}`);
            else if (locator1.identHash !== locator2.identHash)
              throw new Error(`Assertion failed: ${nodeModulesLocation} cannot merge nodes with different idents ${prevNode.nodePath}/${structUtils.stringifyLocator(locator1)} and ${parentNodePath}/s${structUtils.stringifyLocator(locator2)}`);

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

      buildTree(dep, leafNode.linkType === LinkType.SOFT ? leafNode.target : nodeModulesLocation, nodePath);
    }
  };

  const rootNode = makeLeafNode({name: hoistedTree.name, reference: Array.from(hoistedTree.references)[0] as string}, ``, []);
  const rootPath = rootNode.target;
  tree.set(rootPath, rootNode);
  buildTree(hoistedTree, rootPath, ``);

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
    const {packageTree, hoistingLimits} = buildPackageTree(pnp, options);
    const hoistedTree = hoist(packageTree, {hoistingLimits});
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
        str += dumpTree(ppath.join(nodePath, dir), `${prefix}${idx < dirs.length - 1 ? `│ ` : `  `}`);
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
      str += dumpPackage(dep, [...parents, dep], `${prefix}${idx < dependencies.length - 1 ? `│ ` : `  `}`);
    }
    return str;
  };

  return dumpPackage(tree, []);
};
