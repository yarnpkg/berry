/**
 * Package id - a number that uniquiely identifies both package and its dependencies.
 * There must be package with id 0 - which contains all the other packages.
 */
export type PackageId = number;

/**
 * Package name - a string that denotes the fact that two packages with the same name
 * cannot be dependencies of the same parent package. The package with the same name
 * can have multiple package ids associated with the packages, either because of the
 * different package versions, or because of the different dependency sets,
 * as in peer dependent package.
 */
export type PackageName = string;

/**
 * Package weight - a number that somehow signifies which package is heavier and should have
 * a priority to be hoisted. The packages having the biggest weight with all their transitive
 * dependencies are hoisted first.
 */
export type Weight = number;

/**
 * Package tree - is simply a map, with key being package id and the value - the dependencies
 * of that package.
 *
 * Hoisted package tree has the same type, but values should be treated as not necesseraly
 * dependencies, but rather hoisted packages.
 */
export type PackageTree = Map<PackageId, Set<PackageId>>;

/**
 * Initial information about the package.
 */
export interface PackageInfo {
  /** The name of the package */
  name: PackageName;
  /** The own weight of the package, without its transitive dependencies */
  weight: Weight;
}

/**
 * A map with initial information about each package
 */
export type PackageMap = Map<PackageId, PackageInfo>;

/**
 * The results of weighting each package with its transitive dependencies in some subtree.
 */
type WeightMap = Map<PackageId, Weight>;

type Voidable<T> = T | void;

const NO_DEPS = new Set<PackageId>();

/**
 * The raw hoister is responsible for transforming a tree of dependencies to reduce tree
 * height as much as possible. It uses the fact that if dependency is not found for some
 * package, it will be searched over the folder of its parent package dependencies. And
 * hence we can lift dependencies that have different names to the parent package "dependencies",
 * thus reducing tree height.
 *
 * Theoretical computational complexity of hoisting algorhitm is O(n^2) (when no hoisting can be
 * done on all the tree), but in practice it should make much less iterations over tree, due to
 * real dependency trees more often then not can be almost fully hoisted.
 */
export class RawHoister {
  /**
   * Hoists package tree, by applying hoisting algorithm to each tree node independently.
   * We first try to hoist all the packages from anywhere in the whole tree to the root package.
   * Then we apply the same algorithm to the subtree that starts at one of the dependencies of the
   * root package, we do this for each dependency, then move further down to dependencies of
   * dependencies, etc.
   *
   * @param tree package tree
   * @param packageMap package map
   * @param nohoist package ids that should be excluded from applying hoisting algorithm. Nohoist
   *                packages can be hoisted themselves, and their dependencies can be hoisted too,
   *                but only to the package itself, they cannot be hoisted to the nohoist package parent
   */
  public hoist(tree: PackageTree, packageMap: PackageMap, nohoist: Set<PackageId> = new Set()): PackageTree {
    // Validate the tree and package map first
    this.validate(tree, packageMap);

    // Make normalized tree copy, which will be mutated by hoisting algorithm
    const normalizedTree = this.normalize(tree);

    // Apply mutating hoisting algorithm on each tree node starting from the root
    this.traverse(normalizedTree, 0, (nodeId) => {
      this.hoistInplace(normalizedTree, nodeId, packageMap, nohoist);
    });

    // Take care of hoisting results to have deterministic form
    const result = new Map();
    const pkgIds = Array.from(normalizedTree.keys()).sort();
    for (const pkgId of pkgIds)
      result.set(pkgId, new Set(Array.from(normalizedTree.get(pkgId)!).sort()));

    return result;
  }

  /**
   * Performs package subtree hoisting to its root.
   * This funtion mutates tree.
   *
   * @param tree package tree
   * @param rootId package subtree root package id
   * @param packageMap package map
   * @param nohoist nohoist package ids
   */
  private hoistInplace(tree: PackageTree, rootId: PackageId, packageMap: PackageMap, nohoist: Set<PackageId>): void {
    // Get the list of package ids that can and should be hoisted to the subtree root
    const hoistedDepIds = this.computeHoistCandidates(tree, rootId, packageMap, nohoist);

    const removeHoistedDeps = (nodeId: PackageId) => {
      // No need to traverse past nohoist node
      if (nohoist.has(nodeId))
        return;

      const depIds = tree.get(nodeId) || NO_DEPS;
      for (const depId of depIds) {
        // First traverse to deeper levels
        removeHoistedDeps(depId);
        // Then remove hoisted deps from current node
        if (hoistedDepIds.has(depId)) {
          depIds.delete(depId);
        }
      }
      // Remove node without deps
      if (nodeId !== rootId && depIds.size === 0) {
        tree.delete(nodeId);
      }
    };

    removeHoistedDeps(rootId);

    const nodeDepIds = tree.get(rootId)!;
    for (const depId of hoistedDepIds) {
      // Add hoisted packages to the subtree root
      nodeDepIds.add(depId);
    }
  }

  /**
   * Traverses the package tree by visting each package and executing callback,
   * starting from the package with id `rootId`
   *
   * @param tree package tree
   * @param rootId root node id
   * @param visitNode visitor callback
   */
  private traverse(tree: PackageTree, rootId: PackageId, visitNode: (nodeId: PackageId, depIds: Set<PackageId>) => Voidable<() => void>) {
    const depIds = tree.get(rootId) || NO_DEPS;
    const cleanup = visitNode(rootId, depIds);
    for (const depId of depIds)
      this.traverse(tree, depId, visitNode);
    if (cleanup) {
      cleanup();
    }
  }

  /**
   * Checks if information about every package in the tree is available in packageMap
   * and throws if it is not so.
   *
   * @param tree package tree
   * @param packageMap package map
   */
  private validate(tree: PackageTree, packageMap: PackageMap): void {
    this.traverse(tree, 0, (nodeId: PackageId) => {
      if (!packageMap.has(nodeId)) {
        throw new Error(`Package with id ${nodeId} must be present in package map`);
      }
    });
  }

  /**
   * Creates normalized package tree copy by removing cycles, 1 -> 2 -> 1 is converted to 1 -> 2.
   *
   * @param tree package tree
   *
   * @returns normalized package tree
   */
  private normalize(tree: PackageTree): PackageTree {
    // All dependent package ids (values in the map)
    const allDepIds = new Set();
    // Seen package ids - all seen package ids in the path from tree root to current node
    const seenIds = new Set();
    // Normalized tree copy
    const normalTree = new Map();

    this.traverse(tree, 0, (nodeId, depIds) => {
      seenIds.add(nodeId);

      // Normalized dependenciess
      // We strip dependency ids that produce cycles, e.g. 1 -> 2 -> 1, we left 1 -> 2 in this case
      const normalDepIds = new Set();

      for (const depId of depIds) {
        allDepIds.add(depId);
        if (!seenIds.has(depId)) {
          normalDepIds.add(depId);
        }
      }

      return () => {
        normalTree.set(nodeId, normalDepIds);
        seenIds.delete(nodeId);
      };
    });

    return normalTree;
  }

  /**
   * Weighs all the packages in the subtree, by adding up own package weight with weights of all
   * of its direct and transitive dependencies.
   *
   * @param tree package tree
   * @param rootId root package id of the subtree
   * @param packageMap package map
   * @param nohoist nohoist package ids, that shouldn't be weighed
   *
   * @return map of package weights: package id -> total weight
   */
  private weighPackages(tree: PackageTree, rootId: PackageId, packageMap: PackageMap, nohoist: Set<PackageId>): WeightMap {
    const weights: WeightMap = new Map();

    this.traverse(tree, rootId, (nodeId) => {
      if (!nohoist.has(nodeId)) {
        weights.set(nodeId, packageMap.get(nodeId)!.weight + (weights.get(nodeId) || 0));
      }
    });

    return weights;
  }

  /**
   * Finds packages that have the max weight among the packages with the same name
   *
   * @param weights package weights map: package id -> total weight
   * @param packageMap package info map: package id -> package name
   *
   * @returns package ids with max weights among the packages with the same name
   */
  private getHeaviestPackages(weights: WeightMap, packageMap: PackageMap): Set<PackageId> {
    const heaviestPackages = new Map<PackageName, {weight: Weight, pkgId: PackageId}>();
    for (const [pkgId, weight] of weights) {
      const pkgName = packageMap.get(pkgId)!.name;
      let heaviestPkg = heaviestPackages.get(pkgName)!;
      if (!heaviestPkg) {
        heaviestPkg = {weight, pkgId};
        heaviestPackages.set(pkgName, heaviestPkg);
      } else if (weight > heaviestPkg.weight) {
        heaviestPkg.weight = weight;
        heaviestPkg.pkgId = pkgId;
      }
    }

    const heavyPackageIds = new Set<PackageId>();
    for (const [,pkg] of heaviestPackages)
      heavyPackageIds.add(pkg.pkgId);

    return heavyPackageIds;
  }

  /**
   * Find the packages that can be hoisted to the subtree root `rootId`.
   *
   * @param tree package tree
   * @param rootId package id that should be regarded as subtree root
   * @param packageMap package map
   * @param nohoist nohoist package ids
   */
  private computeHoistCandidates(tree: PackageTree, rootId: PackageId, packageMap: PackageMap, nohoist: Set<PackageId>): Set<PackageId> {
    // Get current package dependency package names
    const curDepNames = new Map<PackageName, PackageId>();
    for (const depId of tree.get(rootId) || NO_DEPS)
      curDepNames.set(packageMap.get(depId)!.name, depId);

    // At first all the packages in the subtree are hoist candidates, we weigh them all
    const hoistCandidateWeights = this.weighPackages(tree, rootId, packageMap, nohoist);

    // Current package cannot be hoisted to itself, so we remove it from candidates
    hoistCandidateWeights.delete(rootId);

    for (const [candidateId] of hoistCandidateWeights) {
      const pkgName = packageMap.get(candidateId)!.name;
      const curDepId = curDepNames.get(pkgName);
      if (curDepId && curDepId !== candidateId) {
        // We cannot hoist package with the same name but different id, remove it from candidates
        hoistCandidateWeights.delete(candidateId);
      }
    }

    // Among all hoist candidates left choose the heaviest
    return this.getHeaviestPackages(hoistCandidateWeights, packageMap);
  }
};
