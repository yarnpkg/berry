type PackageName = string;
export type HoisterTree = {name: PackageName, reference: string, deps: Set<HoisterTree>, peerNames: Set<PackageName>};
export type HoisterResult = {name: PackageName, references: Set<string>, deps: Set<HoisterResult>};
type Locator = string;
type PhysicalLocator = string;
type HoisterWorkTree = {name: PackageName, references: Set<string>, log: string[], physicalLocator: PhysicalLocator, locator: Locator, deps: Map<PackageName, HoisterWorkTree>, origDeps: Map<PackageName, HoisterWorkTree>, hoistedDeps: Map<PackageName, HoisterWorkTree>, peerNames: ReadonlySet<PackageName>};

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

    const deps = new Map(parentDeps);
    for (const dep of node.deps.values())
      if (!node.peerNames.has(dep.name))
        deps.set(dep.name, dep);

    for (const origDep of node.origDeps.values()) {
      const dep = deps.get(origDep.name);
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
    for (const dep of node.deps.values()) {
      if (!node.peerNames.has(dep.name)) {
        checkNode(dep, deps, nextParents);
      }
    }
  };

  checkNode(tree, tree.deps, new Set<HoisterWorkTree>());

  return log.join('\n');
};

/**
 * Performs hoisting all the dependencies down the tree to the root node.
 *
 * This method mutates the tree.
 *
 * @param rootNode root node to hoist to
 * @param ancestorMap ancestor map
 */
const hoistTo = (tree: HoisterWorkTree, rootNode: HoisterWorkTree, ancestorMap: AncestorMap, options: HoistOptions, seenNodes: Set<HoisterWorkTree> = new Set()): number => {
  if (seenNodes.has(rootNode))
    return 0;
  seenNodes.add(rootNode);

  let totalHoisted = hoistPass(tree, rootNode, ancestorMap, options);

  let childrenHoisted = 0;
  for (const dep of rootNode.deps.values())
    childrenHoisted += hoistTo(tree, dep, ancestorMap, options, seenNodes);

  if (childrenHoisted > 0)
    // We need second hoisting pass, because some of the children were hoisted
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
        const {name, references, physicalLocator, locator, log, deps, origDeps, hoistedDeps, peerNames} = parent!;
        parentNode = {
          name,
          references: new Set(references),
          physicalLocator,
          locator,
          log,
          deps: new Map(deps),
          origDeps: new Map(origDeps),
          hoistedDeps: new Map(hoistedDeps),
          peerNames: new Set(peerNames),
        };
        clonedParents.set(parent, parentNode);
        rootNode.deps.set(parentNode.name, parentNode);
      }
      // Delete hoisted node from parent node
      parentNode.deps.delete(node.name);
      parentNode.hoistedDeps.set(node.name, node);

      const hoistedNode = rootNode.deps.get(node.name);
      // Add hoisted node to root node, in case it is not already there
      if (!hoistedNode) {
      // Avoid adding node to itself
        if (node.physicalLocator !== rootNode.physicalLocator) {
          rootNode.deps.set(node.name, node);
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
      const rootDep = rootNode.deps.get(node.name);
      const origRootDep = rootNode.origDeps.get(node.name);
      const hoistedRootDep = rootNode.hoistedDeps.get(node.name);
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
      // Check that hoisted deps of current node are satisifed
      for (const dep of node.hoistedDeps.values()) {
        if (node.origDeps.has(dep.name)) {
          const rootDepNode = rootNode.deps.get(dep.name) || rootNode.hoistedDeps.get(dep.name);
          if (!rootDepNode || rootDepNode.physicalLocator !== dep.physicalLocator) {
            isHoistable = false;
          }
        }
        if (!isHoistable) {
          break;
        }
      }

      // Check that hoisted deps of unhoisted children are still satisifed
      if (isHoistable) {
        const checkChildren = (node: HoisterWorkTree): boolean => {
          for (const dep of node.deps.values()) {
            if (node.origDeps.has(dep.name) && !node.peerNames.has(dep.name)) {
              for (const subDep of dep.hoistedDeps.values()) {
                const rootDepNode = rootNode.deps.get(subDep.name) || rootNode.hoistedDeps.get(subDep.name);
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
        const parentDepNode = parentNode.deps.get(name);
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

  for (const dep of rootNode.deps.values()) {
    for (const subDep of dep.deps.values()) {
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
    deps: new Map(),
    origDeps: new Map(),
    hoistedDeps: new Map(),
    peerNames: new Set(peerNames),
    log: [],
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
        deps: new Map(),
        origDeps: new Map(),
        hoistedDeps: new Map(),
        peerNames: new Set(peerNames),
        log: [],
      };
      seenNodes.set(node, workNode);
    }

    parentNode.deps.set(workNode.name, workNode);
    parentNode.origDeps.set(workNode.name, workNode);

    if (!isSeen) {
      for (const dep of node.deps) {
        addNode(node, dep, workNode);
      }
    }
  };

  for (const dep of tree.deps)
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
    deps: new Set(),
  };

  const addNode = (node: HoisterWorkTree, parentNode: HoisterResult, parents: Set<HoisterWorkTree>) => {
    if (parents.has(node))
      return;

    const {name, references} = node;
    const resultNode = {
      name, references, deps: new Set<HoisterResult>(),
    };

    parentNode.deps.add(resultNode);

    for (const dep of node.deps.values()) {
      if (!node.peerNames.has(dep.name)) {
        addNode(dep, resultNode, new Set(parents).add(node));
      }
    }
  };

  for (const dep of tree.deps.values())
    addNode(dep, treeCopy, new Set([tree]));

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
      for (const dep of node.deps.values()) {
        addParent(new Set(parentNodes).add(node), dep);
      }
    }
  };

  for (const dep of tree.deps.values())
    addParent(new Set([tree]), dep);

  return ancestorMap;
};
