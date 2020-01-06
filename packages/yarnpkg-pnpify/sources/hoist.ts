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

/**
 * Package tree - is simply an array, with index being package id and the value - the dependencies
 * of that package. Package tree can contain cycles.
 *
 * Hoisted package tree has the same type, but values should be treated as not necesseraly
 * dependencies, but rather hoisted packages.
 */
export type HoisterPackageTree = {pkgId: HoisterPackageId, deps: Set<HoisterPackageTree>, peerDepIds: Set<HoisterPackageId>};
export type HoisterResultTree = {pkgId: HoisterPackageId, deps: Set<HoisterResultTree>};
type TrackedHoisterPackageTree = {pkgId: HoisterPackageId, deps: Set<TrackedHoisterPackageTree>, origDepIds: Set<HoisterPackageId>, peerDepIds: Set<HoisterPackageId>, origPeerDepIds: Set<HoisterPackageId>};

/**
 * Initial information about the package.
 */
export interface HoisterPackageInfo {
  /** The name of the package */
  name: HoisterPackageName;
  /** Full package locator, used for troubleshooting purposes */
  locatorKey?: string;
}

/**
 * The results of weighting each package with its transitive dependencies in some subtree.
 */
type WeightMap = Map<TrackedHoisterPackageTree, HoisterWeight>;

/**
 * Mapping which packages depend on a given package. It is used to determine hoisting weight,
 * e.g. which one among the group of packages with the same name should be hoisted.
 * The package having the biggest self-weight (including all transitive dependencies) multiplied
 * by the number of ancestors using this package will be hoisted.
 */
type AncestorMap = Array<Set<HoisterPackageId>>;

/**
 * Hoists package tree, by applying hoisting algorithm to each package independently.
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
export const hoist = (tree: HoisterPackageTree, packageInfos: ReadonlyArray<HoisterPackageInfo>, nohoist: ReadonlySet<HoisterPackageId> = new Set()): HoisterResultTree => {
  // Make tree copy, which will be mutated by hoisting algorithm
  const treeCopy = cloneTree(tree);

  const seenPkgs = new Set<TrackedHoisterPackageTree>();

  const hoistSubTree = (pkg: TrackedHoisterPackageTree, ancestorMap: AncestorMap) => {
    if (seenPkgs.has(pkg))
      return;
    seenPkgs.add(pkg);

    // Apply mutating hoisting algorithm on each root package starting from the top
    hoistInplace(pkg, packageInfos, ancestorMap, nohoist);

    for (const depPkg of pkg.deps) {
      hoistSubTree(depPkg, ancestorMap);
    }
  };

  hoistSubTree(treeCopy, buildAncestorMap(tree));

  return shrinkTree(treeCopy);
};

/**
 * Creates a clone of package tree with extra fields used for hoisting purposes.
 *
 * @param tree package tree clone
 */
const cloneTree = (tree: HoisterPackageTree): TrackedHoisterPackageTree => {
  const treeCopy: TrackedHoisterPackageTree = {pkgId: tree.pkgId, deps: new Set(), origDepIds: new Set(), peerDepIds: new Set(tree.peerDepIds), origPeerDepIds: new Set(tree.peerDepIds)};

  const seenNodes = new Set<HoisterPackageTree>();

  const copySubTree = (srcNode: HoisterPackageTree, dstNode: TrackedHoisterPackageTree) => {
    if (seenNodes.has(srcNode))
      return;
    seenNodes.add(srcNode);

    for (const depNode of srcNode.deps) {
      if (depNode.pkgId === srcNode.pkgId && (depNode.deps.size > 0 || depNode.peerDepIds.size > 0))
        throw new Error(`Assert: package ${depNode.pkgId} self-reference must have empty deps and peerDeps`);

      const newNode: TrackedHoisterPackageTree = {pkgId: depNode.pkgId, deps: new Set(), origDepIds: new Set(), peerDepIds: new Set(depNode.peerDepIds), origPeerDepIds: new Set(depNode.peerDepIds)};
      dstNode.deps.add(newNode);
      dstNode.origDepIds.add(depNode.pkgId);
      copySubTree(depNode, newNode);
    }
  };

  copySubTree(tree, treeCopy);

  return treeCopy;
};

/**
 * Creates a clone of package tree with temporary fields removed
 *
 * @param tree package tree clone
 */
const shrinkTree = (tree: TrackedHoisterPackageTree): HoisterResultTree => {
  const treeCopy: HoisterResultTree = {pkgId: tree.pkgId, deps: new Set()};

  const seenNodes = new Set<TrackedHoisterPackageTree>();

  const copySubTree = (srcNode: TrackedHoisterPackageTree, dstNode: HoisterResultTree) => {
    if (seenNodes.has(srcNode))
      return;
    seenNodes.add(srcNode);

    for (const depNode of srcNode.deps) {
      const newNode: HoisterResultTree = {pkgId: depNode.pkgId, deps: new Set()};
      dstNode.deps.add(newNode);
      copySubTree(depNode, newNode);
    }
  };

  copySubTree(tree, treeCopy);

  return treeCopy;
};

/**
 * Builds mapping, where index is a package of concern package id and the value is the list of
 * ancestors who depend on this package.
 *
 * @param tree package tree
 *
 * @returns ancestor map
 */
const buildAncestorMap = (tree: HoisterPackageTree): AncestorMap => {
  const ancestorMap: AncestorMap = [];

  const seenPkgs = new Set<HoisterPackageTree>();

  const addAncestor = (parentPkgIds: HoisterPackageId[], pkg: HoisterPackageTree) => {
    if (seenPkgs.has(pkg))
      return;
    seenPkgs.add(pkg);

    for (const depPkg of pkg.deps) {
      let ancestors = ancestorMap[depPkg.pkgId];
      if (!ancestors) {
        ancestors = new Set(parentPkgIds);
        ancestorMap[depPkg.pkgId] = ancestors;
      }

      ancestors.add(pkg.pkgId);

      addAncestor([...parentPkgIds, depPkg.pkgId], depPkg);
    }
  };

  addAncestor([], tree);

  return ancestorMap;
};

/**
 * Performs package subtree hoisting to its root.
 * This funtion mutates tree.
 *
 * @param rootPkg currently hoisted root package
 * @param packages package infos
 * @param ancestorMap ancestor map
 * @param nohoist nohoist package ids
 */
const hoistInplace = (rootPkg: TrackedHoisterPackageTree, packages: ReadonlyArray<HoisterPackageInfo>, ancestorMap: AncestorMap, nohoist: ReadonlySet<HoisterPackageId>): void => {
  // Get the list of package ids that can and should be hoisted to the subtree root
  const hoistedDeps = computeHoistCandidates(rootPkg, packages, ancestorMap, nohoist);
  const seenPkgs = new Set<TrackedHoisterPackageTree>();

  const hoistedDepIds = new Set<HoisterPackageId>();
  for (const dep of hoistedDeps)
    hoistedDepIds.add(dep.pkgId);

  const removeHoistedDeps = (pkg: TrackedHoisterPackageTree) => {
    if (seenPkgs.has(pkg))
      return;
    seenPkgs.add(pkg);

    // No need to traverse past nohoist package
    if (nohoist.has(pkg.pkgId))
      return;

    for (const depPkg of pkg.deps) {
      // First traverse to deeper levels
      removeHoistedDeps(depPkg);

      // Then remove hoisted deps from current package
      if (hoistedDepIds.has(depPkg.pkgId)) {
        pkg.deps.delete(depPkg);
        // Remove hoisted dependency from the ancestor map
        ancestorMap[depPkg.pkgId].delete(pkg.pkgId);
      }
    }
  };

  removeHoistedDeps(rootPkg);

  for (const dep of hoistedDeps) {
    // Add hoisted packages to the root package, omit self-reference
    // Top-level self-reference should not be omitted, since for the top level to require
    // itself the symlink should be created self/node_modules/self -> ../..
    if (dep.pkgId === 0 || dep.pkgId !== rootPkg.pkgId) {
      rootPkg.deps.add(dep);
    }
  }
};

/**
 * Finds packages that have the max weight among the packages with the same name
 *
 * @param weights package weights map: package id -> total weight
 * @param packages package infos
 *
 * @returns package ids with max weights among the packages with the same name
 */
const getHeaviestPackages = (weights: WeightMap, packages: ReadonlyArray<HoisterPackageInfo>): Set<TrackedHoisterPackageTree> => {
  const heaviestPackages = new Map<HoisterPackageName, {weight: HoisterWeight, pkg: TrackedHoisterPackageTree}>();
  for (const [pkg, weight] of weights) {
    const pkgName = packages[pkg.pkgId].name;
    let heaviestPkg = heaviestPackages.get(pkgName);
    if (!heaviestPkg) {
      heaviestPkg = {weight, pkg};
      heaviestPackages.set(pkgName, heaviestPkg);
    } else if (weight > heaviestPkg.weight) {
      heaviestPkg.weight = weight;
      heaviestPkg.pkg = pkg;
    }
  }

  const heavyPackages = new Set<TrackedHoisterPackageTree>();
  for (const {pkg} of heaviestPackages.values())
    heavyPackages.add(pkg);

  return heavyPackages;
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
 * @param rootPkg currently hoisted root package
 * @param packages package infos
 * @param ancestorMap ancestor map
 * @param nohoist nohoist package ids
 */
const computeHoistCandidates = (rootPkg: TrackedHoisterPackageTree, packages: ReadonlyArray<HoisterPackageInfo>, ancestorMap: AncestorMap, nohoist: ReadonlySet<HoisterPackageId>): Set<TrackedHoisterPackageTree> => {
  // Packages that should be hoisted for sure (they have only 1 version)
  const packagesToHoist = new Set<TrackedHoisterPackageTree>();
  // Names of the packages of hoist candidates
  const packagesToHoistNames: Map<HoisterPackageName, TrackedHoisterPackageTree> = new Map();
  // Hoist candidates that has no peer deps or that has all peer deps already hoisted
  const pureHoistCandidates = new Set<TrackedHoisterPackageTree>();
  // Hoist candidate ids must be unique (it does not matter which one of the package copies we hoist)
  const hoistCandidateIds = new Set<HoisterPackageId>();
  // Hoist candidates with peer deps
  const hoistCandidatesWithPeerDeps = new Set<TrackedHoisterPackageTree>();

  const seenDepNames = new Map<HoisterPackageName, HoisterPackageId>();
  for (const depId of rootPkg.origDepIds)
    seenDepNames.set(packages[depId].name, depId);
  for (const depId of rootPkg.origPeerDepIds)
    seenDepNames.set(packages[depId].name, depId);

  const seenPkgs = new Set<TrackedHoisterPackageTree>();
  const findHoistCandidates = (pkg: TrackedHoisterPackageTree) => {
    if (seenPkgs.has(pkg))
      return;
    seenPkgs.add(pkg);

    const name = packages[pkg.pkgId].name;
    const seenPkgId = seenDepNames.get(name);

    // Check rule 1
    if (!hoistCandidateIds.has(pkg.pkgId) && !rootPkg.origPeerDepIds.has(pkg.pkgId) && (!seenPkgId || seenPkgId === pkg.pkgId)) {
      if (pkg.peerDepIds.size > 0) {
        hoistCandidatesWithPeerDeps.add(pkg);
      } else {
        const hoistCandidate = packagesToHoistNames.get(name);
        if (hoistCandidate && hoistCandidate.pkgId !== pkg.pkgId) {
          packagesToHoist.delete(hoistCandidate);
          pureHoistCandidates.add(hoistCandidate);
          pureHoistCandidates.add(pkg);
        } else {
          packagesToHoist.add(pkg);
          packagesToHoistNames.set(name, pkg);
        }
      }
      hoistCandidateIds.add(pkg.pkgId);
    }

    if (!seenPkgId)
      seenDepNames.set(name, pkg.pkgId);

    for (const depNode of pkg.deps)
      findHoistCandidates(depNode);

    if (!seenPkgId) {
      seenDepNames.delete(name);
    }
  };

  // Find packages names that are candidates for hoisting
  for (const depNode of rootPkg.deps)
    findHoistCandidates(depNode);

  const pureHoistCandidatesWeights: WeightMap = new Map();
  for (const pkg of pureHoistCandidates)
    pureHoistCandidatesWeights.set(pkg, ancestorMap[pkg.pkgId].size);

  // Among all pure hoist candidates choose the heaviest and add them to packages to hoist list
  getHeaviestPackages(pureHoistCandidatesWeights, packages).forEach(pkg => {
    packagesToHoistNames.set(packages[pkg.pkgId].name, pkg);
    packagesToHoist.add(pkg);
  });

  let newHoistCandidates = packagesToHoist;
  // Loop until new hoist candidates appear
  while (newHoistCandidates.size > 0) {
    const newHoistCandidateIds = new Set<HoisterPackageId>();
    for (const cand of newHoistCandidates)
      newHoistCandidateIds.add(cand.pkgId);

    let nextHoistCandidates = new Set<TrackedHoisterPackageTree>();

    for (const peerDepCand of hoistCandidatesWithPeerDeps) {
      // Peer dependencies that are going to be hoisted to the top, or were hoisted above the top
      const nonHoistedPeerDeps = peerDepCand.peerDepIds;

      /* eslint-disable arca/curly */
      if (nonHoistedPeerDeps.size < newHoistCandidates.size) {
        for (const peerDepId of nonHoistedPeerDeps)
          if (newHoistCandidateIds.has(peerDepId))
            // Remove all the packages that are going to be hoisted from current peer deps
            nonHoistedPeerDeps.delete(peerDepId);
      } else {
        for (const candidateId of newHoistCandidateIds)
          if (nonHoistedPeerDeps.has(candidateId))
            // Remove all the packages that are going to be hoisted from current peer deps
            nonHoistedPeerDeps.delete(candidateId);
      }
      /* eslint-enable arca/curly */

      if (nonHoistedPeerDeps.size === 0) {
        // Check that we don't already have the package with the same name but different version
        // among hoist candidates
        const name = packages[peerDepCand.pkgId].name;
        const hoistedPkg = packagesToHoistNames.get(name);

        // Recheck rule 1 for the peer dependent package that is going to be hoisted
        if (!hoistedPkg || hoistedPkg.pkgId === peerDepCand.pkgId) {
          // Peer dependent package can be hoisted if all of its peer deps are going to be hoisted
          nextHoistCandidates.add(peerDepCand);
          packagesToHoist.add(peerDepCand);
          packagesToHoistNames.set(name, peerDepCand);
          hoistCandidatesWithPeerDeps.delete(peerDepCand);
        } else {
          // We cannot hoist this package without breaking rule 1, stop trying
          hoistCandidatesWithPeerDeps.delete(peerDepCand);
        }
      }
    }

    newHoistCandidates = nextHoistCandidates;
  }

  return packagesToHoist;
};
