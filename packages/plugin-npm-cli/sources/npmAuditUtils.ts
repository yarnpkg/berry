import {DescriptorHash, Project, Workspace} from '@yarnpkg/core';

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
