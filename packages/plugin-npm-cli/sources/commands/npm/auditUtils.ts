import {DescriptorHash, LocatorHash, Project, Workspace} from '@yarnpkg/core';

// Enumerate all the transitive dependencies of a set of top-level packages
function getTransitiveDependencies(project: Project, roots: Array<DescriptorHash>): Set<DescriptorHash> {
  // Queue of dependency descriptorHashes to visit; set of already-visited patterns
  const queue: Array<DescriptorHash> = [];
  const descriptorHashes = new Set<DescriptorHash>();

  const enqueue = (descriptorHash: DescriptorHash) => {
    if (descriptorHashes.has(descriptorHash))
      return;

    descriptorHashes.add(descriptorHash);
    queue.push(descriptorHash);
  };

  roots.forEach(enqueue);

  // Final result set
  const transitiveDependencies = new Set<DescriptorHash>();

  const {storedResolutions, originalPackages} = project;

  while (queue.length > 0) {
    const descriptorHash = queue.shift();
    const locatorHash = storedResolutions.get(descriptorHash as DescriptorHash);
    const originalPackage = originalPackages.get(locatorHash as LocatorHash);

    if (!originalPackage)
      continue;

    // Add the dependency to the result set
    transitiveDependencies.add(descriptorHash as DescriptorHash);

    // Enqueue any dependencies of the dependency for processing
    const dependencyDescriptorHashes = Array.from(originalPackage.dependencies.values()).map(dependency => dependency.descriptorHash);
    dependencyDescriptorHashes.forEach(enqueue);
  }

  return transitiveDependencies;
}

function setDifference<T>(x: Set<T>, y: Set<T>): Set<T> {
  return new Set([...x].filter(value => !y.has(value)));
}

// Given a manifest, an optional workspace layout, and a lockfile, enumerate
// all package versions that:
// i) are present in the lockfile
// ii) are a transitive dependency of some top-level devDependency
// iii) are not a transitive dependency of some top-level production dependency
export function getTransitiveDevDependencies(
  project: Project,
  workspace: Workspace,
): Set<string> {
  // Enumerate the top-level package manifest as well as any workspace manifests
  const manifests = [workspace.manifest, ...project.workspaces.map(workspace => workspace.manifest)];

  // Collect all the top-level production and development dependencies across all manifests
  const productionRoots = manifests.map(manifest => Array.from(manifest.dependencies).map(([identHash, descriptor]) => descriptor.descriptorHash)).flat();
  const developmentRoots = manifests.map(manifest => Array.from(manifest.devDependencies).map(([identHash, descriptor]) => descriptor.descriptorHash)).flat();

  // Enumerate all the transitive production and development dependencies
  const productionDependencies = getTransitiveDependencies(project, productionRoots);
  const developmentDependencies = getTransitiveDependencies(project, developmentRoots);

  // Exclude any development dependencies that are also production dependencies
  return setDifference(developmentDependencies, productionDependencies);
}
