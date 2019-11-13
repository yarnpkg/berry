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

interface TrackedHoisterDependencies extends HoisterDependencies
{
  // The peer dependencies that have not been hoisted yet
  nonHoistedPeerDeps: Set<HoisterPackageId>
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

type TrackedHoisterPackageTree = TrackedHoisterDependencies[];

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
  const treeCopy: TrackedHoisterPackageTree = tree.map(({deps, peerDeps}) => ({deps: new Set(deps), peerDeps: new Set(peerDeps), nonHoistedPeerDeps: new Set(peerDeps)}));

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
const hoistInplace = (tree: TrackedHoisterPackageTree, rootId: HoisterPackageId, packages: ReadonlyArray<HoisterPackageInfo>, nohoist: ReadonlySet<HoisterPackageId>): void => {
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
 * @param weighCanidates packages that should be weighed
 * @param tree package tree
 * @param packages package infos
 * @param nohoist nohoist package ids, that shouldn't be weighed
 *
 * @return map of package weights: package id -> total weight
 */
const weighPackages = (weighCanidates: ReadonlySet<HoisterPackageId>, tree: ReadonlyHoisterPackageTree, packages: ReadonlyArray<HoisterPackageInfo>, nohoist: ReadonlySet<HoisterPackageId>): WeightMap => {
  const nodeWeights: WeightMap = new Map();

  const weighNode = (nodeId: HoisterPackageId): HoisterWeight => {
    if (!nodeWeights.has(nodeId)) {
      nodeWeights.set(nodeId, 0);

      if (!nohoist.has(nodeId)) {
        let totalWeigth = packages[nodeId].weight;
        for (const depId of tree[nodeId].deps)
          totalWeigth += weighNode(depId);
        nodeWeights.set(nodeId, totalWeigth);
      }
    }
    return nodeWeights.get(nodeId)!;
  };

  const weights: WeightMap = new Map();
  for (const nodeId of weighCanidates)
    weights.set(nodeId, weighNode(nodeId));

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
 * Rules of hoisting packages to the current tree root:
 * 1. Must keep require promise:
 *    A package cannot be hoisted to the top over the package with the same name, but different version
 *    . → A@X → B@X → C@X → B@Y → A@Y → D@Y
 *      ⟶ D@X
 *    It is forbidden to hoist B@Y to the top, because C@X will require B@X instead of B@Y
 *    It is also forbidden to hoist A@Y to the top, because A@X is already there
 *    And it is forbidded to hoist D@Y to the top, because the top peer depends on D@X already
 * 2. Must keep peer dependency promise:
 *    A package cannot be hoisted to the top, if it has peer dependencies that cannot be hoisted to the top or above the top
 *    . → A@X → B@X
 *            → C@X ⟶ B@X
 *      → B@Y
 *    It is forbidden to hoist C@X to the top, because it has peer dependency B@X that cannot
 *    be hoisted to the top, and C@X will require B@Y instead of B@X
 *    It is also forbidden to hoist D@Y to the top, because it already peer depends on D@X
 *
 * @param tree package tree
 * @param rootId package id that should be regarded as subtree root
 * @param packages package infos
 * @param nohoist nohoist package ids
 */
const computeHoistCandidates = (tree: TrackedHoisterPackageTree, rootId: HoisterPackageId, packages: ReadonlyArray<HoisterPackageInfo>, nohoist: ReadonlySet<HoisterPackageId>): Set<HoisterPackageId> => {
  // Hoist candidates that has no peer deps or that has all peer deps already hoisted
  const pureHoistCandidates = new Set<HoisterPackageId>();
  // Hoist candidates with peer deps
  const hoistCandidatesWithPeerDeps = new Set<HoisterPackageId>();

  const seenDepNames = new Map<HoisterPackageName, HoisterPackageId>();
  for (const depId of tree[rootId].deps)
    seenDepNames.set(packages[depId].name, depId);
  for (const depId of tree[rootId].peerDeps)
    seenDepNames.set(packages[depId].name, depId);

  const seenIds = new Set<HoisterPackageId>();
  const findHoistCandidates = (nodeId: HoisterPackageId) => {
    seenIds.add(nodeId);

    const name = packages[nodeId].name;
    const seenPkgId = seenDepNames.get(name);
    const pkg = tree[nodeId];

    if (!tree[rootId].peerDeps.has(nodeId) && (!seenPkgId || seenPkgId === nodeId)) {
      if (pkg.nonHoistedPeerDeps.size > 0) {
        hoistCandidatesWithPeerDeps.add(nodeId);
      } else {
        pureHoistCandidates.add(nodeId);
      }
    }

    if (!seenPkgId)
      seenDepNames.set(name, nodeId);

    for (const depId of pkg.deps)
      if (!seenIds.has(depId))
        findHoistCandidates(depId);

    if (!seenPkgId) {
      seenDepNames.delete(name);
    }
  };

  // Find packages names that are candidates for hoisting
  for (const depId of tree[rootId].deps)
    if (!seenIds.has(depId))
      findHoistCandidates(depId);

  const pureHoistCandidatesWeights = weighPackages(pureHoistCandidates, tree, packages, nohoist);

  // Among all pure hoist candidates choose the heaviest
  const hoistCandidates = getHeaviestPackages(pureHoistCandidatesWeights, packages);
  const hoistCandidateNames: Map<HoisterPackageName, HoisterPackageId> = new Map();

  for (const pkgId of hoistCandidates)
    hoistCandidateNames.set(packages[pkgId].name, pkgId);

  let newHoistCandidates = hoistCandidates;
  // Loop until new hoist candidates appear
  while (newHoistCandidates.size > 0) {
    let nextHoistCandidates = new Set<HoisterPackageId>();

    for (const peerDepCandId of hoistCandidatesWithPeerDeps) {
      // Peer dependencies that are going to be hoisted to the top, or were hoisted above the top
      const nonHoistedPeerDeps = tree[peerDepCandId].nonHoistedPeerDeps;

      /* eslint-disable arca/curly */
      if (nonHoistedPeerDeps.size < newHoistCandidates.size) {
        for (const peerDepId of nonHoistedPeerDeps)
          if (newHoistCandidates.has(peerDepId))
            // Remove all the packages that are going to be hoisted from current peer deps
            nonHoistedPeerDeps.delete(peerDepId);
      } else {
        for (const candidateId of newHoistCandidates)
          if (nonHoistedPeerDeps.has(candidateId))
            // Remove all the packages that are going to be hoisted from current peer deps
            nonHoistedPeerDeps.delete(candidateId);
      }
      /* eslint-enable arca/curly */

      if (nonHoistedPeerDeps.size === 0) {
        // Check that we don't already have the package with the same name but different version
        // among hoist candidates
        const name = packages[peerDepCandId].name;
        const hoistedPkgId = hoistCandidateNames.get(name);

        // Recheck rule 1 for the peer dependent package that is going to be hoisted
        if (!hoistedPkgId || hoistedPkgId === peerDepCandId) {
          // Peer dependent package can be hoisted if all of its peer deps are going to be hoisted
          nextHoistCandidates.add(peerDepCandId);
          hoistCandidates.add(peerDepCandId);
          hoistCandidateNames.set(name, peerDepCandId);
          hoistCandidatesWithPeerDeps.delete(peerDepCandId);
        } else {
          // We cannot hoist this package without breaking rule 1, stop trying
          hoistCandidatesWithPeerDeps.delete(peerDepCandId);
        }
      }
    }

    newHoistCandidates = nextHoistCandidates;
  }

  return hoistCandidates;
};
