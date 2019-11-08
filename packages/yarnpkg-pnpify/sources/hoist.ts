/**
 * Package id - a number that uniquiely identifies both package and its dependencies.
 * There must be package with id 0 - which contains all the other packages.
 */
export type HoisterPackageId = number;

/**
 * Package name - a string that denotes the fact that two packages with the same name
 * cannot be dependencies of the same parent package. The package with the same name
 * can have multiple package ids associated with the packages, either because of the
 * different package versions, or because of the different dependency sets,
 * as in peer dependent package.
 */
export type HoisterPackageName = string;

/**
 * Package weight - a number that somehow signifies which package is heavier and should have
 * a priority to be hoisted. The packages having the biggest weight with all their transitive
 * dependencies are hoisted first.
 */
export type HoisterWeight = number;

export interface HoisterDependencies
{
  deps: Set<HoisterPackageId>,
  peerDeps: Set<HoisterPackageId>
}

export interface ReadonlyHoisterDependencies
{
  deps: ReadonlySet<HoisterPackageId>,
  peerDeps: ReadonlySet<HoisterPackageId>
}

/**
 * Package tree - is simply an array, with index being package id and the value - the dependencies
 * of that package. Package tree can contain cycles.
 *
 * Hoisted package tree has the same type, but values should be treated as not necesseraly
 * dependencies, but rather hoisted packages.
 */
export type ReadonlyHoisterPackageTree = ReadonlyArray<ReadonlyHoisterDependencies>;
export type HoisterPackageTree = HoisterDependencies[];
export type HoistedTree = Array<Set<HoisterPackageId>>;

/**
 * Initial information about the package.
 */
export interface HoisterPackageInfo {
  /** The name of the package */
  name: HoisterPackageName;
  /** The own weight of the package, without its transitive dependencies */
  weight: HoisterWeight;
}

/**
 * The results of weighting each package with its transitive dependencies in some subtree.
 */
type WeightMap = Map<HoisterPackageId, HoisterWeight>;
type ReadonlyWeightMap = ReadonlyMap<HoisterPackageId, HoisterWeight>;

/**
 * Hoists package tree, by applying hoisting algorithm to each tree node independently.
 * We first try to hoist all the packages from anywhere in the whole tree to the root package.
 * Then we apply the same algorithm to the subtree that starts at one of the dependencies of the
 * root package, we do this for each dependency, then move further down to dependencies of
 * dependencies, etc.
 *
 * This function does not mutate its arguments, it hoists and returns tree copy
 *
 * @param tree package tree (cycles in the tree are allowed)
 * @param packageInfos package infos
 * @param nohoist package ids that should be excluded from applying hoisting algorithm. Nohoist
 *                packages can be hoisted themselves, and their dependencies can be hoisted too,
 *                but only to the package itself, they cannot be hoisted to the nohoist package parent
 *
 * @returns hoisted tree copy
 */
export const hoist = (tree: ReadonlyHoisterPackageTree, packageInfos: ReadonlyArray<HoisterPackageInfo>, nohoist: ReadonlySet<HoisterPackageId> = new Set()): HoistedTree => {
  // Make tree copy, which will be mutated by hoisting algorithm
  const treeCopy: HoisterPackageTree = tree.map(({deps, peerDeps}) => ({deps: new Set(deps), peerDeps: new Set(peerDeps)}));

  const seenIds = new Set<HoisterPackageId>();

  const hoistSubTree = (nodeId: HoisterPackageId) => {
    seenIds.add(nodeId);

    // Apply mutating hoisting algorithm on each tree node starting from the root
    hoistInplace(treeCopy, nodeId, packageInfos, nohoist);

    for (const depId of treeCopy[nodeId].deps) {
      if (!seenIds.has(depId)) {
        hoistSubTree(depId);
      }
    }
  };

  if (treeCopy.length > 0 && treeCopy[0].deps.size > 0)
    hoistSubTree(0);

  return treeCopy.map(({deps}) => deps);
};

/**
 * Performs package subtree hoisting to its root.
 * This funtion mutates tree.
 *
 * @param tree package tree
 * @param rootId package subtree root package id
 * @param packages package infos
 * @param nohoist nohoist package ids
 */
const hoistInplace = (tree: HoisterPackageTree, rootId: HoisterPackageId, packages: ReadonlyArray<HoisterPackageInfo>, nohoist: ReadonlySet<HoisterPackageId>): void => {
  // Get the list of package ids that can and should be hoisted to the subtree root
  const hoistedDepIds = computeHoistCandidates(tree, rootId, packages, nohoist);
  const seenIds = new Set<HoisterPackageId>();

  const removeHoistedDeps = (nodeId: HoisterPackageId) => {
    seenIds.add(nodeId);
    // No need to traverse past nohoist node
    if (nohoist.has(nodeId))
      return;

    const depIds = tree[nodeId].deps;
    for (const depId of depIds) {
      // First traverse to deeper levels
      if (!seenIds.has(depId))
        removeHoistedDeps(depId);

      // Then remove hoisted deps from current node
      if (hoistedDepIds.has(depId)) {
        depIds.delete(depId);
      }
    }
  };

  removeHoistedDeps(rootId);

  const nodeDepIds = tree[rootId].deps;
  for (const depId of hoistedDepIds) {
    // Add hoisted packages to the subtree root
    nodeDepIds.add(depId);
  }
};

/**
 * Weighs all the packages in the subtree, by adding up own package weight with weights of all
 * of its direct and transitive dependencies.
 *
 * @param tree package tree
 * @param rootId root package id of the subtree
 * @param packages package infos
 * @param nohoist nohoist package ids, that shouldn't be weighed
 *
 * @return map of package weights: package id -> total weight
 */
const weighPackages = (tree: ReadonlyHoisterPackageTree, rootId: HoisterPackageId, packages: ReadonlyArray<HoisterPackageInfo>, nohoist: ReadonlySet<HoisterPackageId>): WeightMap => {
  const weights: WeightMap = new Map();
  const seenIds = new Set<HoisterPackageId>();

  const addUpNodeWeight = (nodeId: HoisterPackageId) => {
    seenIds.add(nodeId);

    if (!nohoist.has(nodeId)) {
      weights.set(nodeId, packages[nodeId].weight + (weights.get(nodeId) || 0));
      for (const depId of tree[nodeId].deps) {
        if (!seenIds.has(depId)) {
          addUpNodeWeight(depId);
        }
      }
    }
  };

  addUpNodeWeight(rootId);

  return weights;
};

/**
 * Finds packages that have the max weight among the packages with the same name
 *
 * @param weights package weights map: package id -> total weight
 * @param packages package infos
 *
 * @returns package ids with max weights among the packages with the same name
 */
const getHeaviestPackages = (weights: ReadonlyWeightMap, packages: ReadonlyArray<HoisterPackageInfo>): Set<HoisterPackageId> => {
  const heaviestPackages = new Map<HoisterPackageName, {weight: HoisterWeight, pkgId: HoisterPackageId}>();
  for (const [pkgId, weight] of weights) {
    const pkgName = packages[pkgId].name;
    let heaviestPkg = heaviestPackages.get(pkgName);
    if (!heaviestPkg) {
      heaviestPkg = {weight, pkgId};
      heaviestPackages.set(pkgName, heaviestPkg);
    } else if (weight > heaviestPkg.weight) {
      heaviestPkg.weight = weight;
      heaviestPkg.pkgId = pkgId;
    }
  }

  const heavyPackageIds = new Set<HoisterPackageId>();
  for (const {pkgId} of heaviestPackages.values())
    heavyPackageIds.add(pkgId);

  return heavyPackageIds;
};

/**
 * Find the packages that can be hoisted to the subtree root `rootId`.
 *
 * @param tree package tree
 * @param rootId package id that should be regarded as subtree root
 * @param packages package infos
 * @param nohoist nohoist package ids
 */
const computeHoistCandidates = (tree: HoisterPackageTree, rootId: HoisterPackageId, packages: ReadonlyArray<HoisterPackageInfo>, nohoist: ReadonlySet<HoisterPackageId>): Set<HoisterPackageId> => {
  // Get current package dependency package names
  const rootDepNames = new Map<HoisterPackageName, HoisterPackageId>();
  for (const depId of tree[rootId].deps)
    rootDepNames.set(packages[depId].name, depId);

  // Weigh all the packages in the subtree
  const packageWeights = weighPackages(tree, rootId, packages, nohoist);

  const hoistCandidateWeights: WeightMap = new Map();
  const hoistPeerDepCandidates = new Set<HoisterPackageId>();
  const seenPackageNames = new Set<HoisterPackageName>();
  const seenPackageIds = new Set<HoisterPackageId>();

  const findHoistCandidates = (nodeId: HoisterPackageId) => {
    seenPackageIds.add(nodeId);
    const name = packages[nodeId].name;
    // Package names that exist only in a single instance in the tree path are hoist candidates
    if (!seenPackageNames.has(name)) {
      seenPackageNames.add(name);
      const rootDepId = rootDepNames.get(name);
      // If the hoisting candidate has the same name as existing root subtree dependency,
      // we can only hoist it if its id is also the same
      // . → A → B@X → C → B@Y, - we can hoist only B@X here
      if (nodeId !== rootId && (!rootDepId || rootDepId === nodeId)) {
        const pkg = tree[nodeId];
        if (pkg.peerDeps.size > 0) {
          hoistPeerDepCandidates.add(nodeId);
        } else {
          hoistCandidateWeights.set(nodeId, packageWeights.get(nodeId)!);
        }
      }

      for (const depId of tree[nodeId].deps)
        if (!seenPackageIds.has(depId))
          findHoistCandidates(depId);

      seenPackageNames.delete(name);
    }
  };

  // Find packages names that are candidates for hoisting
  findHoistCandidates(rootId);

  // Among all hoist candidates choose the heaviest
  const hoistCandidates = getHeaviestPackages(hoistCandidateWeights, packages);

  let hoistCandidatesChanged;
  // Loop until hoist candidates set changes
  do {
    hoistCandidatesChanged = false;
    for (const peerDepCandId of hoistPeerDepCandidates) {
      const peerDeps = tree[peerDepCandId].peerDeps;
      for (const peerDepId of peerDeps)
        if (hoistCandidates.has(peerDepId))
          // Remove all the packages that are going to be hoisted from current peer deps
          peerDeps.delete(peerDepId);
      if (peerDeps.size === 0) {
        // Peer dependent package can be hoisted if all of its peer deps are going to be hoisted
        hoistCandidates.add(peerDepCandId);
        hoistPeerDepCandidates.delete(peerDepCandId);
        hoistCandidatesChanged = true;
      }
    }
  } while (hoistCandidatesChanged);

  return hoistCandidates;
};
