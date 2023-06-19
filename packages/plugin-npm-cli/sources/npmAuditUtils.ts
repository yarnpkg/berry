import {Project, Workspace, formatUtils, structUtils, treeUtils, Descriptor, miscUtils, Locator, LocatorHash} from '@yarnpkg/core';
import semver                                                                                                 from  'semver';

import * as npmAuditTypes                                                                                     from './npmAuditTypes';

export const allSeverities = [
  npmAuditTypes.Severity.Info,
  npmAuditTypes.Severity.Low,
  npmAuditTypes.Severity.Moderate,
  npmAuditTypes.Severity.High,
  npmAuditTypes.Severity.Critical,
];

export function getSeverityInclusions(severity?: npmAuditTypes.Severity): Set<npmAuditTypes.Severity> {
  if (typeof severity === `undefined`)
    return new Set(allSeverities);

  const severityIndex = allSeverities.indexOf(severity);
  const severities = allSeverities.slice(severityIndex);

  return new Set(severities);
}

export function getReportTree(result: npmAuditTypes.AuditExtendedResponse) {
  const auditTreeChildren: treeUtils.TreeMap = {};
  const auditTree: treeUtils.TreeNode = {children: auditTreeChildren};

  for (const [packageName, advisories] of miscUtils.sortMap(Object.entries(result), advisory => advisory[0])) {
    for (const advisory of miscUtils.sortMap(advisories, advisory => `${advisory.id}`)) {
      auditTreeChildren[`${packageName}/${advisory.id}`] = {
        value: formatUtils.tuple(formatUtils.Type.IDENT, structUtils.parseIdent(packageName)),
        children: {
          ID: typeof advisory.id !== `undefined` && {
            label: `ID`,
            value: formatUtils.tuple(formatUtils.Type.ID, advisory.id),
          },
          Issue: {
            label: `Issue`,
            value: formatUtils.tuple(formatUtils.Type.NO_HINT, advisory.title),
          },
          URL: typeof advisory.url !== `undefined` && {
            label: `URL`,
            value: formatUtils.tuple(formatUtils.Type.URL, advisory.url),
          },
          Severity: {
            label: `Severity`,
            value: formatUtils.tuple(formatUtils.Type.NO_HINT, advisory.severity),
          },
          [`Vulnerable Versions`]: {
            label: `Vulnerable Versions`,
            value: formatUtils.tuple(formatUtils.Type.RANGE, advisory.vulnerable_versions),
          },
          [`Tree Versions`]: {
            label: `Tree Versions`,
            children: [...advisory.versions].sort(semver.compare).map(version => ({
              value: formatUtils.tuple(formatUtils.Type.REFERENCE, version),
            })),
          },
          Dependents: {
            label: `Dependents`,
            children: miscUtils.sortMap(advisory.dependents, locator => structUtils.stringifyLocator(locator)).map(locator => ({
              value: formatUtils.tuple(formatUtils.Type.LOCATOR, locator),
            })),
          },
        },
      };
    }
  }

  return auditTree;
}

export type TopLevelDependency = {
  workspace: Workspace;
  dependency: Descriptor;
};

export function getTopLevelDependencies(project: Project, workspace: Workspace, {all, environment}: {all: boolean, environment: npmAuditTypes.Environment}) {
  const topLevelDependencies: Array<TopLevelDependency> = [];

  const workspaces = all
    ? project.workspaces
    : [workspace];

  const includeDependencies = [
    npmAuditTypes.Environment.All,
    npmAuditTypes.Environment.Production,
  ].includes(environment);

  const includeDevDependencies = [
    npmAuditTypes.Environment.All,
    npmAuditTypes.Environment.Development,
  ].includes(environment);

  for (const workspace of workspaces) {
    for (const dependency of workspace.anchoredPackage.dependencies.values()) {
      const isDevDependency = workspace.manifest.devDependencies.has(dependency.identHash);
      if (isDevDependency ? !includeDevDependencies : !includeDependencies)
        continue;

      topLevelDependencies.push({workspace, dependency});
    }
  }

  return topLevelDependencies;
}

export function getPackages(project: Project, roots: Array<TopLevelDependency>, {recursive}: {recursive: boolean}) {
  const packages = new Map<string, Map<string, Array<Locator>>>();

  const traversed = new Set<LocatorHash>();
  const queue: Array<[Locator, Descriptor]> = [];

  const processDescriptor = (parent: Locator, descriptor: Descriptor) => {
    const resolution = project.storedResolutions.get(descriptor.descriptorHash);
    if (typeof resolution === `undefined`)
      throw new Error(`Assertion failed: The resolution should have been registered`);

    if (!traversed.has(resolution))
      traversed.add(resolution);
    else
      return;

    const pkg = project.storedPackages.get(resolution);
    if (typeof pkg === `undefined`)
      throw new Error(`Assertion failed: The package should have been registered`);

    const devirtualizedLocator = structUtils.ensureDevirtualizedLocator(pkg);

    if (devirtualizedLocator.reference.startsWith(`npm:`) && pkg.version !== null) {
      const packageName = structUtils.stringifyIdent(pkg);

      const versions = miscUtils.getMapWithDefault(packages, packageName);
      miscUtils.getArrayWithDefault(versions, pkg.version).push(parent);
    }

    if (recursive) {
      for (const dependency of pkg.dependencies.values()) {
        queue.push([pkg, dependency]);
      }
    }
  };

  for (const {workspace, dependency} of roots)
    queue.push([workspace.anchoredLocator, dependency]);

  while (queue.length > 0) {
    const [pkg, dependency] = queue.shift()!;
    processDescriptor(pkg, dependency);
  }

  return packages;
}
