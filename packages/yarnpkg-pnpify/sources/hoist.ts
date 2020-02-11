type PackageName = string;
export type HoisterTree = {name: PackageName, reference: string, dependencies: Set<HoisterTree>, peerNames: Set<PackageName>};
export type HoisterResult = {name: PackageName, references: Set<string>, dependencies: Set<HoisterResult>};
type Locator = string;
type PhysicalLocator = string;
type HoisterWorkTree = {name: PackageName, references: Set<string>, physicalLocator: PhysicalLocator, locator: Locator, dependencies: Map<PackageName, HoisterWorkTree>, originalDependencies: Map<PackageName, HoisterWorkTree>, hoistedDependencies: Map<PackageName, HoisterWorkTree>, peerNames: ReadonlySet<PackageName>};

type HoistCandidate = {
  node: HoisterWorkTree,
  parent: HoisterWorkTree
};

/**
 * Mapping which packages depend on a given package. It is used to determine hoisting weight,
 * e.g. which one among the group of packages with the same name should be hoisted.
 * The package having the biggest number of ancestors using this package will be hoisted.
 */
type AncestorMap = Map<PhysicalLocator, Set<PhysicalLocator>>;

const makeLocator = (name: string, reference: string) => `${name}@${reference}`;
const makePhysicalLocator = (name: string, reference: string) => {
  const hashIdx = reference.indexOf('#');
  // Strip virtual reference part, we don't need it for hoisting purposes
  const realReference = hashIdx >= 0 ? reference.substring(hashIdx + 1) : reference!;
  return makeLocator(name, realReference);
};

type HoistOptions = {
  check: boolean;
};

/**
 * Hoists package tree.
 *
 * The root node of a tree must has id: '.'.
 * This function does not mutate its arguments, it hoists and returns tree copy.
 *
 * @param tree package tree (cycles in the tree are allowed)
 *
 * @returns hoisted tree copy
 */
export const hoist = (tree: HoisterTree, options: HoistOptions = {check: false}): HoisterResult => {
  const treeCopy = cloneTree(tree);
  const ancestorMap = buildAncestorMap(treeCopy);

  hoistTo(treeCopy, treeCopy, ancestorMap, options);

  return shrinkTree(treeCopy);
};

const selfCheck = (tree: HoisterWorkTree): string => {
  let log: string[] = [];
  const seenNodes = new Set();
  const checkNode = (node: HoisterWorkTree, parentDeps: Map<PackageName, HoisterWorkTree>, parents: Set<HoisterWorkTree>) => {
    if (seenNodes.has(node))
      return;
    seenNodes.add(node);

    if (parents.has(node))
      return;

    const dependencies = new Map(parentDeps);
    for (const dep of node.dependencies.values())
      if (!node.peerNames.has(dep.name))
        dependencies.set(dep.name, dep);

    for (const origDep of node.originalDependencies.values()) {
      const dep = dependencies.get(origDep.name);
      if (node.peerNames.has(origDep.name)) {
        const parentDep = parentDeps.get(origDep.name);
        if (parentDep !== dep) {
          log.push(`${Array.from(parents).concat([node]).map(x => x.locator).join('#')} - broken peer promise: expected ${dep!.locator} but found ${parentDep ? parentDep.locator : parentDep}`);
        }
      } else {
        if (!dep) {
          log.push(`${Array.from(parents).concat([node]).map(x => x.locator).join('#')} - broken require promise: no required dependency ${origDep.locator} found`);
        } else if (dep.physicalLocator !== origDep.physicalLocator) {
          log.push(`${Array.from(parents).concat([node]).map(x => x.locator).join('#')} - broken require promise: expected ${origDep.physicalLocator}, but found: ${dep.physicalLocator}`);
        }
      }
    }

    const nextParents = new Set(parents).add(node);
    for (const dep of node.dependencies.values()) {
      if (!node.peerNames.has(dep.name)) {
        checkNode(dep, dependencies, nextParents);
      }
    }
  };

  checkNode(tree, tree.dependencies, new Set<HoisterWorkTree>());

  return log.join('\n');
};

/**
 * Performs hoisting all the dependencies down the tree to the root node.
 *
 * The algorithm used here reduces dependency graph by deduplicating
 * instances of the packages while keeping:
 * 1. Regular dependency promise: the package should require the exact version of the dependency
 * that was declared in its `package.json`
 * 2. Peer dependency promise: the package and its direct parent package
 * must use the same instance of the peer dependency
 *
 * The regular and peer dependency promises are kept while performing transform
 * on triples of packages at a time:
 * `root package` -> `parent package` -> `dependency`
 * We check wether we can hoist `dependency` to `root package`, this boils down basically
 * to checking:
 * 1. Wether `root package` does not depend on other version of `dependency`
 * 2. Wether all the peer dependencies of a `dependency` had already been hoisted from `parent package`
 *
 * If many versions of the `dependency` can be hoisted to the `root package` we choose the most used
 * `dependency` version in the project among them.
 *
 * This algorithm is shallow first, e.g. it transforms the tree:
 * . -> A -> B -> C
 * in this order:
 * 1) . -> A
 *      -> B -> C
 * 2) . -> A
 *      -> B
 *      -> C
 *
 * This function mutates the tree.
 *
 * @param rootNode root node to hoist to
 * @param ancestorMap ancestor map
 */
const hoistTo = (tree: HoisterWorkTree, rootNode: HoisterWorkTree, ancestorMap: AncestorMap, options: HoistOptions, seenNodes: Set<HoisterWorkTree> = new Set()): number => {
  if (seenNodes.has(rootNode))
    return 0;
  seenNodes.add(rootNode);

  // Perform shallow-first hoisting by hoisting to the root node first
  let totalHoisted = hoistPass(tree, rootNode, ancestorMap, options);

  let childrenHoisted = 0;
  // Now perform children hoisting
  for (const dep of rootNode.dependencies.values())
    childrenHoisted += hoistTo(tree, dep, ancestorMap, options, seenNodes);

  if (childrenHoisted > 0)
    // Perfrom 2nd pass of hoisting to the root node, because some of the children were hoisted
    hoistPass(tree, rootNode, ancestorMap, options);

  return totalHoisted + childrenHoisted;
};

const hoistPass = (tree: HoisterWorkTree, rootNode: HoisterWorkTree, ancestorMap: AncestorMap, options: HoistOptions): number => {
  let totalHoisted = 0;
  let packagesToHoist: Set<HoistCandidate>;
  const clonedParents = new Map<HoisterWorkTree, HoisterWorkTree>();
  do {
    packagesToHoist = getHoistablePackages(rootNode, ancestorMap);
    totalHoisted += packagesToHoist.size;
    for (const {parent, node} of packagesToHoist) {
      let parentNode = clonedParents.get(parent);
      if (!parentNode) {
        const {name, references, physicalLocator, locator, dependencies, originalDependencies, hoistedDependencies, peerNames} = parent!;
        // To perform node hoisting from parent node we must clone parent node first,
        // because some other package in the tree might depend on the parent package where hoisting
        // cannot be performed
        parentNode = {
          name,
          references: new Set(references),
          physicalLocator,
          locator,
          dependencies: new Map(dependencies),
          originalDependencies: new Map(originalDependencies),
          hoistedDependencies: new Map(hoistedDependencies),
          peerNames: new Set(peerNames),
        };
        clonedParents.set(parent, parentNode);
        rootNode.dependencies.set(parentNode.name, parentNode);
      }
      // Delete hoisted node from parent node
      parentNode.dependencies.delete(node.name);
      parentNode.hoistedDependencies.set(node.name, node);

      const hoistedNode = rootNode.dependencies.get(node.name);
      // Add hoisted node to root node, in case it is not already there
      if (!hoistedNode) {
      // Avoid adding node to itself
        if (node.physicalLocator !== rootNode.physicalLocator) {
          rootNode.dependencies.set(node.name, node);
        }
      } else {
        for (const reference of node.references) {
          hoistedNode.references.add(reference);
        }
      }
      if (options.check) {
        const checkLog = selfCheck(tree);
        if (checkLog) {
          throw new Error(`After hoisting ${rootNode.locator}#${parent.physicalLocator}#${node.physicalLocator}:\n${require('util').inspect(node, {depth: null})}\n${checkLog}`);
        }
      }
    }
  } while (packagesToHoist.size > 0);

  return totalHoisted;
};

type HoistCandidateMap = Map<PackageName, {physicalLocator: PhysicalLocator, tuples: Set<{parent: HoisterWorkTree, node: HoisterWorkTree}>, weight: number}>;

/**
 * Finds all the packages that can be hoisted to the root package node from the set of:
 * `root node` -> `dependency` -> `subdependency`
 *
 * @param rootNode root package node
 * @param ancestorMap ancestor map to determine `dependency` version popularity
 */
const getHoistablePackages = (rootNode: HoisterWorkTree, ancestorMap: AncestorMap): Set<HoistCandidate> => {
  const hoistCandidates: HoistCandidateMap = new Map();

  const computeHoistCandidates = (parentNode: HoisterWorkTree, node: HoisterWorkTree) => {
    let isHoistable: boolean = true;
    let competitorInfo = hoistCandidates.get(node.name);

    const ancestorNode = ancestorMap.get(node.physicalLocator)!;
    const weight = ancestorNode.size;

    if (isHoistable) {
      const isCompatiblePhysicalLocator = (rootNode.name !== node.name || rootNode.physicalLocator === node.physicalLocator);
      isHoistable = isCompatiblePhysicalLocator;
    }

    if (isHoistable) {
      const rootDep = rootNode.dependencies.get(node.name);
      const origRootDep = rootNode.originalDependencies.get(node.name);
      const hoistedRootDep = rootNode.hoistedDependencies.get(node.name);
      const isNameAvailable = (!hoistedRootDep || hoistedRootDep.physicalLocator === node.physicalLocator)
          && (!rootDep || rootDep.physicalLocator === node.physicalLocator)
          && (!origRootDep || origRootDep.physicalLocator === node.physicalLocator);

      isHoistable = isNameAvailable;
    }

    if (isHoistable) {
      const isRegularDepAtRoot = !rootNode.peerNames.has(node.name);
      isHoistable = isRegularDepAtRoot;
    }

    let isPreferred = false;
    if (isHoistable) {
      // If there is a competitor package to be hoisted, we should prefer the package with more usage
      isPreferred = !competitorInfo || competitorInfo.weight < weight;
      isHoistable = isPreferred;
    }

    if (isHoistable) {
      // Check that hoisted dependencies of current node are satisifed
      for (const dep of node.hoistedDependencies.values()) {
        if (node.originalDependencies.has(dep.name)) {
          const rootDepNode = rootNode.dependencies.get(dep.name) || rootNode.hoistedDependencies.get(dep.name);
          if (!rootDepNode || rootDepNode.physicalLocator !== dep.physicalLocator) {
            isHoistable = false;
          }
        }
        if (!isHoistable) {
          break;
        }
      }

      // Check that hoisted dependencies of unhoisted children are still satisifed
      if (isHoistable) {
        const checkChildren = (node: HoisterWorkTree): boolean => {
          for (const dep of node.dependencies.values()) {
            if (node.originalDependencies.has(dep.name) && !node.peerNames.has(dep.name)) {
              for (const subDep of dep.hoistedDependencies.values()) {
                const rootDepNode = rootNode.dependencies.get(subDep.name) || rootNode.hoistedDependencies.get(subDep.name);
                if (!rootDepNode || rootDepNode.physicalLocator !== subDep.physicalLocator || !checkChildren(dep)) {
                  return false;
                }
              }
            }
          }
          return true;
        };
        isHoistable = checkChildren(node);
      }
    }

    if (isHoistable) {
      for (const name of node.peerNames) {
        const parentDepNode = parentNode.dependencies.get(name);
        if (parentDepNode) {
          isHoistable = false;
          break;
        }
      }
    }

    if (isHoistable) {
      let hoistCandidate = hoistCandidates.get(node.name);
      if (!hoistCandidate || (competitorInfo && competitorInfo.physicalLocator !== node.physicalLocator)) {
        hoistCandidate = {physicalLocator: node.physicalLocator, tuples: new Set(), weight};
        hoistCandidates.set(node.name, hoistCandidate);
      }
      hoistCandidate.tuples.add({parent: parentNode, node});
    }
  };

  for (const dep of rootNode.dependencies.values()) {
    for (const subDep of dep.dependencies.values()) {
      computeHoistCandidates(dep, subDep);
    }
  }

  const candidates = new Set<HoistCandidate>();
  for (const {tuples} of hoistCandidates.values())
    for (const tuple of tuples)
      candidates.add(tuple);

  return candidates;
};

/**
 * Creates a clone of package tree with extra fields used for hoisting purposes.
 *
 * @param tree package tree clone
 */
const cloneTree = (tree: HoisterTree): HoisterWorkTree => {
  const {name, reference, peerNames} = tree;
  const treeCopy: HoisterWorkTree = {
    name,
    references: new Set([reference]),
    locator: makeLocator(name, reference),
    physicalLocator: makePhysicalLocator(name, reference),
    dependencies: new Map(),
    originalDependencies: new Map(),
    hoistedDependencies: new Map(),
    peerNames: new Set(peerNames),
  };

  const seenNodes = new Map<HoisterTree, HoisterWorkTree>([[tree, treeCopy]]);

  const addNode = (origParent: HoisterTree, node: HoisterTree, parentNode: HoisterWorkTree) => {
    // Skip self-references
    if (node === origParent)
      return;
    let workNode = seenNodes.get(node);
    const isSeen = !!workNode;
    if (!workNode) {
      const {name, reference, peerNames} = node;
      workNode = {
        name,
        references: new Set([reference]),
        locator: makeLocator(name, reference),
        physicalLocator: makePhysicalLocator(name, reference),
        dependencies: new Map(),
        originalDependencies: new Map(),
        hoistedDependencies: new Map(),
        peerNames: new Set(peerNames),
      };
      seenNodes.set(node, workNode);
    }

    parentNode.dependencies.set(workNode.name, workNode);
    parentNode.originalDependencies.set(workNode.name, workNode);

    if (!isSeen) {
      for (const dep of node.dependencies) {
        addNode(node, dep, workNode);
      }
    }
  };

  for (const dep of tree.dependencies)
    addNode(tree, dep, treeCopy);

  return treeCopy;
};

/**
 * Creates a clone of hoisted package tree with extra fields removed
 *
 * @param tree stripped down hoisted package tree clone
 */
const shrinkTree = (tree: HoisterWorkTree): HoisterResult => {
  const treeCopy: HoisterResult = {
    name: tree.name,
    references: new Set(tree.references),
    dependencies: new Set(),
  };

  const nodes = new Map<HoisterWorkTree, HoisterResult>([[tree, treeCopy]]);

  const addNode = (node: HoisterWorkTree, parentNode: HoisterResult) => {
    let resultNode = nodes.get(node);
    const isSeen = !!resultNode;

    if (!resultNode) {
      const {name, references} = node;
      resultNode = {
        name, references, dependencies: new Set<HoisterResult>(),
      };
    }

    parentNode.dependencies.add(resultNode);

    if (!isSeen) {
      for (const dep of node.dependencies.values()) {
        if (!node.peerNames.has(dep.name)) {
          addNode(dep, resultNode);
        }
      }
    }
  };

  for (const dep of tree.dependencies.values())
    addNode(dep, treeCopy);

  return treeCopy;
};

/**
 * Builds mapping, where key is a dependent package locator and the value is the list of
 * ancestors who depend on this package.
 *
 * @param tree package tree
 *
 * @returns ancestor map
 */
const buildAncestorMap = (tree: HoisterWorkTree): AncestorMap => {
  const ancestorMap: AncestorMap = new Map();

  const seenNodes = new Set<HoisterWorkTree>();

  const addParent = (parentNodes: Set<HoisterWorkTree>, node: HoisterWorkTree) => {
    const isSeen = seenNodes.has(node);
    seenNodes.add(node);

    let parents = ancestorMap.get(node.physicalLocator);
    if (!parents) {
      parents = new Set<PhysicalLocator>();
      ancestorMap.set(node.physicalLocator, parents);
    }
    for (const parent of parentNodes)
      parents.add(parent.physicalLocator);

    if (!isSeen) {
      for (const dep of node.dependencies.values()) {
        addParent(new Set(parentNodes).add(node), dep);
      }
    }
  };

  for (const dep of tree.dependencies.values())
    addParent(new Set([tree]), dep);

  return ancestorMap;
};
