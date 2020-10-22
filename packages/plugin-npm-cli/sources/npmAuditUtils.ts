import {DescriptorHash, Project, Workspace, formatUtils, structUtils, treeUtils, Descriptor} from '@yarnpkg/core';

import * as npmAuditTypes                                                                    from './npmAuditTypes';

// Enumerate all the transitive dependencies of a set of top-level packages
function getTransitiveDependencies(project: Project, roots: Array<DescriptorHash>) {
  // Queue of dependency descriptorHashes to visit; set of already-visited patterns
  const queue: Array<DescriptorHash> = [];
  const descriptorHashes = new Set<DescriptorHash>();

  const enqueue = (descriptorHash: DescriptorHash) => {
    if (descriptorHashes.has(descriptorHash))
      return;

    descriptorHashes.add(descriptorHash);
    queue.push(descriptorHash);
  };

  for (const root of roots)
    enqueue(root);

  // Final result set
  const transitiveDependencies = new Set<DescriptorHash>();

  while (queue.length > 0) {
    const descriptorHash = queue.shift()!;

    const locatorHash = project.storedResolutions.get(descriptorHash);
    if (typeof locatorHash === `undefined`)
      throw new Error(`Assertion failed: Expected the resolution to have been registered`);

    const pkg = project.storedPackages.get(locatorHash);
    if (!pkg)
      continue;

    // Add the dependency to the result set
    transitiveDependencies.add(descriptorHash as DescriptorHash);

    // Enqueue any dependencies of the dependency for processing
    for (const dependency of pkg.dependencies.values()) {
      enqueue(dependency.descriptorHash);
    }
  }

  return transitiveDependencies;
}

function setDifference<T>(x: Set<T>, y: Set<T>): Set<T> {
  return new Set([...x].filter(value => !y.has(value)));
}

// Given a manifest, an optional workspace layout, and a lockfile, enumerate
// all package versions that:
// - are present in the lockfile
// - are a transitive dependency of some top-level devDependency
// - are not a transitive dependency of some top-level production dependency
export function getTransitiveDevDependencies(project: Project, workspace: Workspace, {all}: {all: boolean}): Set<DescriptorHash> {
  // Determine workspaces in scope
  const workspaces = all
    ? project.workspaces
    : [workspace];

  // Enumerate the top-level package manifest as well as any workspace manifests
  const manifests = workspaces.map(workspace => {
    return workspace.manifest;
  });

  // Collect all the top-level production and development dependencies across all manifests
  const productionDependencyIdentSet = new Set(manifests.map(manifest =>
    [...manifest.dependencies].map(([identHash, descriptor]) => identHash),
  ).flat());

  const developmentDependencyIdentSet = new Set(manifests.map(manifest =>
    [...manifest.devDependencies].map(([identHash, descriptor]) => identHash),
  ).flat());

  // Map workspace dependencies to descriptor hashes, filtered by the top-level production and development dependencies
  const workspaceDependencies = workspaces
    .map(workspace => [...workspace.dependencies.values()])
    .flat();

  const productionRoots = workspaceDependencies
    .filter(dependency => productionDependencyIdentSet.has(dependency.identHash))
    .map(dependency => dependency.descriptorHash);

  const developmentRoots = workspaceDependencies
    .filter(dependency => developmentDependencyIdentSet.has(dependency.identHash))
    .map(dependency => dependency.descriptorHash);

  // Enumerate all the transitive production and development dependencies
  const productionDependencies = getTransitiveDependencies(project, productionRoots);
  const developmentDependencies = getTransitiveDependencies(project, developmentRoots);

  // Exclude any development dependencies that are also production dependencies
  return setDifference(developmentDependencies, productionDependencies);
}

export function transformDescriptorIterableToRequiresObject(descriptors: Iterable<Descriptor>) {
  const data: {[key: string]: string} = {};

  for (const descriptor of descriptors)
    data[structUtils.stringifyIdent(descriptor)] = structUtils.parseRange(descriptor.range).selector;

  return data;
}

export function getSeverityInclusions(severity?: npmAuditTypes.Severity): Set<npmAuditTypes.Severity> {
  if (typeof severity === `undefined`)
    return new Set();

  const allSeverities = [
    npmAuditTypes.Severity.Info,
    npmAuditTypes.Severity.Low,
    npmAuditTypes.Severity.Moderate,
    npmAuditTypes.Severity.High,
    npmAuditTypes.Severity.Critical,
  ];

  const severityIndex = allSeverities.indexOf(severity);
  const severities = allSeverities.slice(severityIndex);

  return new Set(severities);
}

export function filterVulnerabilities(vulnerabilities: npmAuditTypes.AuditVulnerabilities, severity?: npmAuditTypes.Severity) {
  const inclusions = getSeverityInclusions(severity);

  const filteredVulnerabilities: Partial<npmAuditTypes.AuditVulnerabilities> = {};
  for (const key of inclusions)
    filteredVulnerabilities[key] = vulnerabilities[key];

  return filteredVulnerabilities;
}

export function isError(vulnerabilities: npmAuditTypes.AuditVulnerabilities, severity?: npmAuditTypes.Severity): boolean {
  const filteredVulnerabilities = filterVulnerabilities(vulnerabilities, severity);

  for (const key of Object.keys(filteredVulnerabilities) as any as Array<npmAuditTypes.Severity>)
    if (filteredVulnerabilities[key] ?? 0 > 0)
      return true;

  return false;
}

export function getReportTree(result: npmAuditTypes.AuditResponse) {
  const auditTreeChildren: treeUtils.TreeMap = {};
  const auditTree: treeUtils.TreeNode = {children: auditTreeChildren};

  Object.values(result.advisories).forEach(advisory => {
    auditTreeChildren[advisory.module_name] = {
      label: advisory.module_name,
      value: formatUtils.tuple(formatUtils.Type.RANGE, advisory.findings.map(finding => finding.version).join(`, `)),
      children: {
        Issue: {
          label: `Issue`,
          value: formatUtils.tuple(formatUtils.Type.NO_HINT, advisory.title),
        },
        URL: {
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
        [`Patched Versions`]: {
          label: `Patched Versions`,
          value: formatUtils.tuple(formatUtils.Type.RANGE, advisory.patched_versions),
        },
        Recommendation: {
          label: `Recommendation`,
          value: formatUtils.tuple(formatUtils.Type.NO_HINT, advisory.recommendation),
        },
        Paths: {
          children: pathListToTreeNode(advisory.findings.map(finding => finding.paths).flat()),
        },
      },
    };
  });

  return auditTree;
}

function pathListToTreeNode(paths: Array<string>): treeUtils.TreeMap {
  const result: Record<string, {value: formatUtils.Tuple, children: treeUtils.TreeMap}> = {};

  paths.map(path => path.split(`>`)).forEach(path => {
    let node: treeUtils.TreeMap = result;
    path.forEach(pkg => {
      node[pkg] = node[pkg] ?? {value: formatUtils.tuple(formatUtils.Type.NAME, pkg), children: {}};
      node = node[pkg].children as treeUtils.TreeMap;
    });
  });

  return result;
}

export function getRequires(project: Project, workspace: Workspace, {all}: {all: boolean}) {
  const workspaces = all
    ? project.workspaces
    : [workspace];

  const includeDependencies = [
    npmAuditTypes.Environment.All,
    npmAuditTypes.Environment.Production,
  ].includes(this.environment);

  const requiredDependencies = [];
  if (includeDependencies)
    for (const workspace of workspaces)
      for (const dependency of workspace.manifest.dependencies.values())
        requiredDependencies.push(dependency);

  const includeDevDependencies = [
    npmAuditTypes.Environment.All,
    npmAuditTypes.Environment.Development,
  ].includes(this.environment);

  const requiredDevDependencies = [];
  if (includeDevDependencies)
    for (const workspace of workspaces)
      for (const dependency of workspace.manifest.devDependencies.values())
        requiredDevDependencies.push(dependency);

  return transformDescriptorIterableToRequiresObject([
    ...requiredDependencies,
    ...requiredDevDependencies,
  ].filter(dependency => {
    return structUtils.parseRange(dependency.range).protocol === null;
  }));
}

export function getDependencies(project: Project, workspace: Workspace, {all}: {all: boolean}) {
  const transitiveDevDependencies = getTransitiveDevDependencies(project, workspace, {all});

  const data: {
    [key: string]: {
      version: string;
      integrity: string;
      requires: {[key: string]: string};
      dev: boolean;
    },
  } = {};

  // BUG: Should be storedPackage
  for (const pkg of project.originalPackages.values()) {
    data[structUtils.stringifyIdent(pkg)] = {
      version: pkg.version ?? `0.0.0`,
      integrity: pkg.identHash,
      requires: transformDescriptorIterableToRequiresObject(pkg.dependencies.values()),
      dev: transitiveDevDependencies.has(structUtils.convertLocatorToDescriptor(pkg).descriptorHash),
    };
  }

  return data;
}
