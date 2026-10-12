import {structUtils}                                                            from '@yarnpkg/core';
import {Filename, PortablePath, ppath}                                          from '@yarnpkg/fslib';
import {PnpApi}                                                                 from '@yarnpkg/pnp';

import {LinkType, NodeModulesBaseNode, NodeModulesPackageNode, NodeModulesTree} from './buildNodeModulesTree';

const NODE_MODULES = `node_modules` as Filename;
const WORKSPACE_NAME_SUFFIX = `$wsroot$`;

export type PackageMap = {
  packages: Record<string, PackageMapPackage>;
};

export type PackageMapPackage = {
  url: string;
  dependencies: Record<string, string>;
};

export type PackageMapOptions = {
  basePath: PortablePath;
  pnp?: PnpApi | null;
};

export type LoosePackageMapOptions = {
  basePath: PortablePath;
};

type PackageMapNode = {
  id: string;
  packagePath: PortablePath;
  dependencyNames: Set<string> | null;
};

const isPackageNode = (node: NodeModulesBaseNode | NodeModulesPackageNode): node is NodeModulesPackageNode => {
  return !node.dirList;
};

const stripTrailingSeparators = (path: PortablePath) => {
  while (path !== PortablePath.root && path.endsWith(ppath.sep))
    path = path.slice(0, -1) as PortablePath;

  return path;
};

const getPackagePath = (location: PortablePath, node: NodeModulesPackageNode) => {
  return stripTrailingSeparators(node.linkType === LinkType.SOFT ? node.target : location);
};

const getRelativeUrl = (from: PortablePath, to: PortablePath) => {
  let relativePath = ppath.relative(from, to) || PortablePath.dot;

  if (!relativePath.startsWith(`.`))
    relativePath = `./${relativePath}` as PortablePath;

  return relativePath;
};

const getPackageId = (basePath: PortablePath, location: PortablePath) => {
  const relativePath = ppath.relative(basePath, location) || PortablePath.dot;

  return relativePath === `..` ? PortablePath.dot : relativePath;
};

const getPackageName = (location: PortablePath) => {
  const segments = location.split(ppath.sep);
  const nodeModulesIndex = segments.lastIndexOf(NODE_MODULES);

  if (nodeModulesIndex === -1)
    return null;

  const scopeOrName = segments[nodeModulesIndex + 1];
  if (typeof scopeOrName === `undefined`)
    return null;

  const nodeModulesPath = segments.slice(0, nodeModulesIndex + 1).join(ppath.sep) as PortablePath;

  if (!scopeOrName.startsWith(`@`))
    return {nodeModulesPath, packageName: scopeOrName};

  const name = segments[nodeModulesIndex + 2];
  if (typeof name === `undefined`)
    return null;

  return {nodeModulesPath, packageName: `${scopeOrName}/${name}`};
};

const compareStrings = (a: string, b: string) => {
  return a < b ? -1 : a > b ? 1 : 0;
};

const getPackageDependencyNames = (pnp: PnpApi, node: NodeModulesPackageNode) => {
  const locator = structUtils.parseLocator(node.locator.replace(WORKSPACE_NAME_SUFFIX, ``));
  const packageInformation = pnp.getPackageInformation({
    name: structUtils.stringifyIdent(locator),
    reference: locator.reference,
  });

  if (packageInformation === null)
    throw new Error(`Assertion failed: Expected ${node.locator} to have been registered`);

  const dependencyNames = new Set<string>();

  for (const [dependencyName, dependencyReference] of packageInformation.packageDependencies)
    if (dependencyReference !== null)
      dependencyNames.add(dependencyName);

  return dependencyNames;
};

const buildPackageMapFromDependencyFilter = (nodeModulesTree: NodeModulesTree, {basePath}: LoosePackageMapOptions, getDependencyNames: (node: NodeModulesPackageNode) => Set<string> | null): PackageMap => {
  const packageMapNodes = new Map<PortablePath, PackageMapNode>();
  const packageLocationsByNodeModulesPath = new Map<PortablePath, Map<string, PortablePath>>();

  basePath = stripTrailingSeparators(basePath);

  for (const [location, node] of nodeModulesTree) {
    if (!isPackageNode(node))
      continue;

    const normalizedLocation = stripTrailingSeparators(location);
    const packageMapNode: PackageMapNode = {
      id: getPackageId(basePath, normalizedLocation),
      packagePath: getPackagePath(normalizedLocation, node),
      dependencyNames: getDependencyNames(node),
    };

    packageMapNodes.set(normalizedLocation, packageMapNode);

    const packageName = getPackageName(normalizedLocation);
    if (packageName !== null) {
      let packageLocations = packageLocationsByNodeModulesPath.get(packageName.nodeModulesPath);
      if (typeof packageLocations === `undefined`) {
        packageLocations = new Map();
        packageLocationsByNodeModulesPath.set(packageName.nodeModulesPath, packageLocations);
      }

      packageLocations.set(packageName.packageName, normalizedLocation);
    }
  }

  const getPackageDependencies = (packagePath: PortablePath, dependencyNames: Set<string> | null) => {
    const dependencies = new Map<string, string>();

    let currentPath = packagePath;
    while (true) {
      const nodeModulesPath = ppath.join(currentPath, NODE_MODULES);
      const packageLocations = packageLocationsByNodeModulesPath.get(nodeModulesPath);

      if (typeof packageLocations !== `undefined`) {
        for (const [dependencyName, dependencyLocation] of packageLocations) {
          if (dependencyNames !== null && !dependencyNames.has(dependencyName))
            continue;

          if (dependencies.has(dependencyName))
            continue;

          const dependency = packageMapNodes.get(dependencyLocation);
          if (typeof dependency === `undefined`)
            throw new Error(`Assertion failed: Expected ${dependencyLocation} to have been registered`);

          dependencies.set(dependencyName, dependency.id);
        }
      }

      const parentPath = ppath.dirname(currentPath);
      if (parentPath === currentPath)
        break;

      currentPath = parentPath;
    }

    return Object.fromEntries(Array.from(dependencies).sort(([a], [b]) => compareStrings(a, b)));
  };

  const packages: PackageMap[`packages`] = {};
  for (const packageMapNode of Array.from(packageMapNodes.values()).sort((a, b) => compareStrings(a.id, b.id))) {
    packages[packageMapNode.id] = {
      url: getRelativeUrl(basePath, packageMapNode.packagePath),
      dependencies: getPackageDependencies(packageMapNode.packagePath, packageMapNode.dependencyNames),
    };
  }

  return {packages};
};

export const buildPackageMap = (nodeModulesTree: NodeModulesTree, {basePath, pnp}: PackageMapOptions): PackageMap => {
  return buildPackageMapFromDependencyFilter(nodeModulesTree, {basePath}, node => {
    return pnp ? getPackageDependencyNames(pnp, node) : null;
  });
};
