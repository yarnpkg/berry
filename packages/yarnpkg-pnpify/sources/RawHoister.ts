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
  private weigh(tree: PackageTree, nodeId: PackageId, packageMap: PackageMap, nohoist: Set<PackageId>, weights: WeightMap = new Map()): WeightMap {
    if (!nohoist.has(nodeId)) {
      weights.set(nodeId, packageMap.get(nodeId)!.weight + (weights.get(nodeId) || 0));
      for (const depId of tree.get(nodeId) || []) {
        this.weigh(tree, depId, packageMap, nohoist, weights);
      }
    }

    return weights;
  }

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

    const result = new Set<PackageId>();
    for (const [,pkg] of heaviestPackages)
      result.add(pkg.pkgId);

    return result;
  }

  /**
   * Returns normalized package tree copy by removing cycles, 1 -> 2 -> 1 is converted to 1 -> 2.
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

    /**
     * Traverses package tree and fills in normalilzed tree copy
     *
     * @param tree source package tree
     * @param nodeId the package id of the node in the tree, 0 - for root node
     */
    const traverse = (tree: PackageTree, nodeId: PackageId): void => {
      seenIds.add(nodeId);

      // Normalized dependenciess
      // We strip dependency ids that produce cycles, e.g. 1 -> 2 -> 1, we left 1 -> 2 in this case
      const normalDepIds = new Set();

      for (const depId of tree.get(nodeId) || []) {
        allDepIds.add(depId);
        if (!seenIds.has(depId)) {
          normalDepIds.add(depId);
          traverse(tree, depId);
        }
      }
      normalTree.set(nodeId, normalDepIds);

      seenIds.delete(nodeId);
    };

    traverse(tree, 0);

    return normalTree;
  }

  public hoist(tree: PackageTree, packageMap: PackageMap, nohoist: Set<PackageId> = new Set()): PackageTree {
    if (!tree.has(0))
      throw new Error('Package tree must have root element with package id 0');

    const normalizedTree = this.normalize(tree);
    const hoistToNode = (nodeId: PackageId) => {
      this.hoistInplace(normalizedTree, nodeId, packageMap, nohoist);
      const depIds = normalizedTree.get(nodeId);
      for (const depId of depIds || []) {
        hoistToNode(depId);
      }
    };

    hoistToNode(0);

    // Make hoisting results have deterministic form
    const result = new Map();
    const pkgIds = Array.from(normalizedTree.keys()).sort();
    for (const pkgId of pkgIds)
      result.set(pkgId, new Set(Array.from(normalizedTree.get(pkgId)!).sort()));

    return result;
  }

  private computeHoistCandidates(tree: PackageTree, nodeId: PackageId, packageMap: PackageMap, nohoist: Set<PackageId>): Set<PackageId> {
    const hoistCandidateWeights = this.weigh(tree, nodeId, packageMap, nohoist);

    hoistCandidateWeights.delete(nodeId);

    const curDepNames = new Map<PackageName, PackageId>();
    for (const depId of tree.get(nodeId) || [])
      curDepNames.set(packageMap.get(depId)!.name, depId);

    for (const [candidateId] of hoistCandidateWeights) {
      const pkgName = packageMap.get(candidateId)!.name;
      const curDepId = curDepNames.get(pkgName);
      if (curDepId && curDepId !== candidateId) {
        hoistCandidateWeights.delete(candidateId);
      }
    }

    return this.getHeaviestPackages(hoistCandidateWeights, packageMap);
  }

  private hoistInplace(tree: PackageTree, nodeId: PackageId, packageMap: PackageMap, nohoist: Set<PackageId>) {
    const hoistedDepIds = this.computeHoistCandidates(tree, nodeId, packageMap, nohoist);

    const removeHoistedDeps = (curNodeId: PackageId) => {
      // No need to traverse past nohoist node
      if (nohoist.has(curNodeId))
        return;

      const nodeDepIds = tree.get(curNodeId)!;
      for (const depId of nodeDepIds || []) {
        removeHoistedDeps(depId);
        if (hoistedDepIds.has(depId)) {
          nodeDepIds.delete(depId);
        }
      }
      // Remove node without deps
      if (curNodeId !== nodeId && nodeDepIds && nodeDepIds.size === 0) {
        tree.delete(curNodeId);
      }
    };

    removeHoistedDeps(nodeId);

    const nodeDepIds = tree.get(nodeId)!;
    for (const depId of hoistedDepIds) {
      nodeDepIds.add(depId);
    }
  }
};
