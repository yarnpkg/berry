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

const DEBUG = false;
const TRACE: string[] = [];
//'sort-keys', 'normalize-url', 'mimic-response', 'cacheable-request', 'clone-response'];

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
export const hoist = (tree: HoisterTree): HoisterResult => {
  const treeCopy = cloneTree(tree);
  const ancestorMap = buildAncestorMap(treeCopy);

  hoistTo(treeCopy, ancestorMap);

  return shrinkTree(treeCopy);
};

/**
 * Performs hoisting all the dependencies down the tree to the root node.
 *
 * This method mutates the tree.
 *
 * @param rootNode root node to hoist to
 * @param ancestorMap ancestor map
 */
const hoistTo = (rootNode: HoisterWorkTree, ancestorMap: AncestorMap, seenNodes: Set<HoisterWorkTree> = new Set()) => {
  if (seenNodes.has(rootNode))
    return;
  seenNodes.add(rootNode);

  for (const dep of rootNode.deps.values()) {
    for (const subDep of dep.deps.values()) {
      if (subDep.deps.size > 0) {
        hoistTo(dep, ancestorMap, seenNodes);
        break;
      }
    }
  }

  hoistPass(rootNode, ancestorMap);
};

const hoistPass = (rootNode: HoisterWorkTree, ancestorMap: AncestorMap): number => {
  let totalHoisted = 0;
  let packagesToHoist: Set<HoistCandidate>;
  const clonedParents = new Map<HoisterWorkTree, HoisterWorkTree>();
  // console.log('hoistTo', rootNode.locator);
  do {
    packagesToHoist = getHoistablePackages(rootNode, ancestorMap);
    totalHoisted += packagesToHoist.size;
    // console.log(`hoistTo: ${rootNode.locator} ${Array.from(packagesToHoist).map(x => x.node.locator)}`);
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

      const hoistedNode = rootNode.deps.get(node.name) || rootNode.hoistedDeps.get(node.name);
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
    }
  } while (packagesToHoist.size > 0);

  return totalHoisted;
};

type HoistCandidateMap = Map<PackageName, {physicalLocator: PhysicalLocator, tuples: Set<{parent: HoisterWorkTree, node: HoisterWorkTree}>, weight: number}>;

const getHoistablePackages = (rootNode: HoisterWorkTree, ancestorMap: AncestorMap): Set<HoistCandidate> => {
  const hoistCandidates: HoistCandidateMap = new Map();
  // const hoistCandidatesWithPeers: HoistCandidateWithPeersMap = new Map();

  // const seenIds = new Set<NodeId>([rootId]);

  const computeHoistCandidates = (parentNode: HoisterWorkTree, node: HoisterWorkTree) => {
    const rootDep = rootNode.deps.get(node.name);

    let isHoistable: boolean = false;
    let competitorInfo = hoistCandidates.get(node.name);

    const ancestorNode = ancestorMap.get(node.physicalLocator)!;
    const weight = ancestorNode.size;
    isHoistable = true;

    const treePath = `${rootNode.locator}#${parentNode.locator}#${node.locator}`;
    const logPrefix = `hoist ${treePath}`;
    if (isHoistable) {
      const isCompatiblePhysicalLocator = (rootNode.name !== node.name || rootNode.physicalLocator === node.physicalLocator);
      if (DEBUG && !isCompatiblePhysicalLocator)
        node.log.push(`${logPrefix} cannot hoist different version ${node.physicalLocator} to the package itself ${rootNode.physicalLocator}`);
      if (TRACE.indexOf(node.name) >= 0 && !isCompatiblePhysicalLocator)
        console.log(`${logPrefix} cannot hoist different version ${node.physicalLocator} to the package itself ${rootNode.physicalLocator}`);
      isHoistable = isCompatiblePhysicalLocator;
    }

    if (isHoistable) {
      const isNameAvailable = (!rootDep || rootDep.physicalLocator === node.physicalLocator);
      if (DEBUG && !isNameAvailable)
        node.log.push(`${logPrefix} name taken by ${rootNode.locator}#${rootDep!.physicalLocator}`);
      if (TRACE.indexOf(node.name) >= 0 && !isNameAvailable)
        console.log(`${logPrefix} name taken by ${rootNode.locator}#${rootDep!.physicalLocator}`);
      isHoistable = isNameAvailable;
    }

    if (isHoistable) {
      const isRegularDepAtRoot = !rootNode.peerNames.has(node.name);
      if (DEBUG && !isRegularDepAtRoot)
        node.log.push(`${logPrefix} ${node.locator} is a peer dep at ${rootNode.locator}`);
      if (TRACE.indexOf(node.name) >= 0 && !isRegularDepAtRoot)
        console.log(`${logPrefix} ${node.locator} is a peer dep at ${rootNode.locator}`);

      isHoistable = isRegularDepAtRoot;
    }

    let isPreferred = false;
    if (isHoistable) {
      // If there is a competitor package to be hoisted, we should prefer the package with more usage
      isPreferred = !competitorInfo || competitorInfo.weight < weight;
      isHoistable = isPreferred;
    }

    if (isHoistable) {
      let isHoistedDepsSatisfied = true;

      for (const [name, origDep] of node.origDeps.entries()) {
        if (node.hoistedDeps.has(name)) {
          const rootDepNode = rootNode.deps.get(name) || rootNode.hoistedDeps.get(name);
          if (!rootDepNode || rootDepNode.physicalLocator !== origDep.physicalLocator) {
            if (DEBUG) {
              if (!rootDepNode) {
                node.log.push(`${logPrefix} root node has no ${name} - cannot be hoisted`);
              } else {
                node.log.push(`${logPrefix} root node has ${rootDepNode.physicalLocator} instead of ${origDep.physicalLocator} - cannot be hoisted`);
              }
            } else if (TRACE.indexOf(node.name) >= 0) {
              if (!rootDepNode) {
                console.log(`${logPrefix} root node has no ${name} - cannot be hoisted`);
              } else {
                console.log(`${logPrefix} root node has ${rootDepNode.physicalLocator} instead of ${origDep.physicalLocator} - cannot be hoisted`);
              }
            }
            isHoistedDepsSatisfied = false;
            break;
          }
        }
      }

      isHoistable = isHoistedDepsSatisfied;
    }

    if (isHoistable) {
      const unsatisfiedPeerDeps = new Set<HoisterWorkTree>();
      for (const name of node.peerNames) {
        const parentDepNode = parentNode.deps.get(name);
        if (parentDepNode) {
          unsatisfiedPeerDeps.add(parentDepNode);
        }
      }
      if (unsatisfiedPeerDeps.size > 0) {
        isHoistable = false;
        if (DEBUG) {
          node.log.push(`${logPrefix} parent node ${parentNode.locator} has unhoisted peers ${Array.from(unsatisfiedPeerDeps).map(x => x.locator)}`);
        } else if (TRACE.indexOf(node.name) >= 0) {
          console.log(`${logPrefix} parent node ${parentNode.locator} has unhoisted peers ${Array.from(unsatisfiedPeerDeps).map(x => x.locator)}`);
        }
      }
    }

    if (DEBUG && isHoistable) {
      if (competitorInfo && isPreferred) {
        node.log.push(`${logPrefix} is more popular than ${competitorInfo!.physicalLocator}(${weight} vs ${competitorInfo!.weight}) added to candidates`);
      } else {
        node.log.push(`${logPrefix} added to hoist candidates`);
      }
    } else if (TRACE.indexOf(node.name) >= 0 && isHoistable) {
      if (competitorInfo && isPreferred) {
        console.log(`${logPrefix} is more popular than ${competitorInfo!.physicalLocator}(${weight} vs ${competitorInfo!.weight}) added to candidates`);
      } else {
        console.log(`${logPrefix} added to hoist candidates`);
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

  if (DEBUG)
    console.log(require('util').inspect(tree, {depth: null, maxArrayLength: null}));

  const seenNodes = new Map<HoisterWorkTree, HoisterResult>([[tree, treeCopy]]);
  const addNode = (node: HoisterWorkTree, parentNode: HoisterResult) => {
    let resultNode = seenNodes.get(node);
    const isSeen = !!resultNode;
    if (!resultNode) {
      const {name, references} = node;
      resultNode = {
        name, references, deps: new Set<HoisterResult>(),
      };
      seenNodes.set(node, resultNode);
    }

    parentNode.deps.add(resultNode);

    if (!isSeen) {
      for (const dep of node.deps.values()) {
        if (!node.peerNames.has(dep.name)) {
          addNode(dep, resultNode);
        }
      }
    }
  };

  for (const dep of tree.deps.values())
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

  const addParent = (parentNode: HoisterWorkTree, node: HoisterWorkTree) => {
    const isSeen = seenNodes.has(node);
    seenNodes.add(node);

    let parents = ancestorMap.get(node.physicalLocator);
    if (!parents) {
      parents = new Set<PhysicalLocator>();
      ancestorMap.set(node.physicalLocator, parents);
    }
    parents.add(parentNode.physicalLocator);

    if (!isSeen) {
      for (const dep of node.deps.values()) {
        addParent(node, dep);
      }
    }
  };

  for (const dep of tree.deps.values())
    addParent(tree, dep);

  return ancestorMap;
};
