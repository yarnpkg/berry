type NodeId = string;
type PackageName = string;
export type HoisterTreeNode = {name: PackageName, reference: string, deps: Set<NodeId>, peerNames: Set<PackageName>, [meta: string]: any};
export type HoisterTree = Map<NodeId, HoisterTreeNode>;
export type HoisterResult = Map<NodeId, HoisterResultNode>;
export type HoisterResultNode = {name: PackageName, reference: string, deps: Set<NodeId>, [meta: string]: any};
type HoisterWorkNode = {name: PackageName, reference: string, log: string[], locator: Locator, deps: Set<NodeId>, depLocators: Map<PackageName, Locator>, depNameToId: Map<PackageName, NodeId>, hoistedDepNames: Map<PackageName, Locator>, peerNames: ReadonlySet<PackageName>, [meta: string]: any};
type HoisterWorkTree = Map<NodeId, HoisterWorkNode>;

type HoistCandidate = {
  name: PackageName,
  hoistableFrom: Set<NodeId>
};

type Locator = string;

const DEBUG = false;

/**
 * Mapping which packages depend on a given package. It is used to determine hoisting weight,
 * e.g. which one among the group of packages with the same name should be hoisted.
 * The package having the biggest number of ancestors using this package will be hoisted.
 */
type AncestorMap = Map<Locator, { direct: Set<Locator>, indirect: Set<Locator>}>;

const makeLocator = (name: string, reference: string) => `${name}@${reference}`;

let lastNodeId: number;

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

  lastNodeId = 1;
  const rootNodeId = '.';
  const startTime = Date.now();
  // for (let iter = 0; iter < 10; iter++)
  hoistTo(treeCopy, rootNodeId, ancestorMap);
  const endTime = Date.now();
  console.log(`hoist time: ${(endTime - startTime)} ms`);

  return shrinkTree(treeCopy);
};

/**
 * Performs hoisting all the dependencies down the tree to the root node.
 *
 * This method mutates the tree.
 *
 * @param tree package tree
 * @param rootId root node id to hoist to
 * @param ancestorMap ancestor map
 */
const hoistTo = (tree: HoisterWorkTree, rootId: NodeId, ancestorMap: AncestorMap, seenIds: Set<NodeId> = new Set()) => {
  if (seenIds.has(rootId))
    return;
  seenIds.add(rootId);
  let packagesToHoist;

  const rootNode = tree.get(rootId)!;

  for (const depId of rootNode.deps) {
    const dep = tree.get(depId)!;
    for (const subDepId of dep.deps) {
      const subDep = tree.get(subDepId)!;
      if (subDep.deps.size > 0) {
        hoistTo(tree, depId, ancestorMap, seenIds);
        break;
      }
    }
  }

  let iter = 0;
  do {
    packagesToHoist = getHoistablePackages(tree, rootId, ancestorMap);
    // if (iter > 0 && packagesToHoist.size > 0)
    //   console.log(`${rootId} - ${iter} - ${packagesToHoist.size}`);
    const clonedParents = new Map<NodeId, NodeId>();
    for (const {name, hoistableFrom} of packagesToHoist.values()) {
      for (const origParentId of hoistableFrom) {
        let parentNodeId = clonedParents.get(origParentId);
        let parentNode;
        if (parentNodeId) {
          parentNode = tree.get(parentNodeId)!;
        } else {
          const {name, reference, locator, log, deps, depLocators, depNameToId, hoistedDepNames, peerNames, ...meta} = tree.get(origParentId)!;

          parentNode = {
            name,
            reference,
            locator,
            log,
            deps: new Set(deps),
            depLocators: new Map(depLocators),
            depNameToId: new Map(depNameToId),
            hoistedDepNames: new Map(hoistedDepNames),
            peerNames: new Set(peerNames),
            ...meta,
          };
          parentNodeId = `${lastNodeId++}`;
          clonedParents.set(origParentId, parentNodeId);
          tree.set(parentNodeId, parentNode);
          rootNode.deps.delete(origParentId);
          rootNode.deps.add(parentNodeId);
          rootNode.depNameToId.set(parentNode.name, parentNodeId);
        }
        const nodeId = parentNode.depNameToId.get(name)!;
        const node = tree.get(nodeId)!;

        // Delete hoisted node from parent node
        parentNode.deps.delete(nodeId);
        parentNode.depNameToId.delete(node.name);
        parentNode.hoistedDepNames.set(node.name, node.locator);

        const prevHoistedNodeId = rootNode.depNameToId.get(node.name);
        // Add hoisted node to root node, in case it is not already there
        if (!prevHoistedNodeId) {
          // Avoid adding node to itself
          if (node.locator !== rootNode.locator) {
            rootNode.deps.add(nodeId);
            rootNode.depNameToId.set(node.name, nodeId);
            rootNode.depLocators.set(node.name, node.locator);
          }
        } else {
          const prevHoistedNode = tree.get(prevHoistedNodeId)!;
          const {name, reference, locator, log, deps, depLocators, depNameToId, hoistedDepNames, peerNames, ...meta} = node;
          for (const [metaKey, metaVal] of Object.entries(meta)) {
            if (!prevHoistedNode[metaKey])
              prevHoistedNode[metaKey] = new Set();
            for (const val of metaVal) {
              prevHoistedNode[metaKey].add(val);
            }
          }
        }
      }
    }
    iter++;
  } while (packagesToHoist.size > 0);
  // console.log(rootId, require('util').inspect(tree, {depth: null}));
};

type HoistCandidateMap = Map<PackageName, {locator: Locator, nodeIds: Set<NodeId>, weight: number, hoistableFrom: Set<NodeId>}>;
type HoistCandidateWithPeersMap = Map<PackageName, Map<NodeId, {locator: Locator, peers: Map<NodeId, Set<NodeId>>}>>;

const getHoistablePackages = (tree: HoisterWorkTree, rootId: NodeId, ancestorMap: AncestorMap): Set<HoistCandidate> => {
  const hoistCandidates: HoistCandidateMap = new Map();
  const hoistCandidatesWithPeers: HoistCandidateWithPeersMap = new Map();

  // const seenIds = new Set<NodeId>([rootId]);
  const rootNode = tree.get(rootId)!;

  const computeHoistCandidates = (parentId: NodeId, nodeId: NodeId, parentNodeNames: Map<string, Locator>) => {
    const node = tree.get(nodeId)!;

    const rootDepLocator = rootNode.depLocators.get(node.name);
    const hoistInfo = hoistCandidates.get(node.name);

    let isHoistable: boolean = false;
    let competitorInfo = hoistCandidates.get(node.name);
    const ancestorNode = ancestorMap.get(node.locator)!;
    const weight = ancestorNode.direct.size + ancestorNode.indirect.size;
    if (rootDepLocator === node.locator
      || rootNode.locator === node.locator
      || (hoistInfo && hoistInfo.locator === node.locator)) {
      isHoistable = true;
    } else {
      const parentNode = tree.get(parentId)!;
      const treePath = `${rootNode.locator}#${parentNode.locator}#${node.locator}`;
      const logPrefix = `hoist ${treePath}`;
      const sameParentNodeNameLocator = parentNodeNames.get(node.name);
      const isNameAvailable = !sameParentNodeNameLocator || sameParentNodeNameLocator === node.locator;
      if (DEBUG && !isNameAvailable)
        node.log.push(`${logPrefix} name taken by ${rootNode.locator}#${sameParentNodeNameLocator}`);
      isHoistable = isNameAvailable;

      if (isHoistable) {
        const isRegularDepAtRoot = !rootNode.peerNames.has(node.name);
        if (DEBUG && !isRegularDepAtRoot)
          node.log.push(`${logPrefix} ${node.locator} is a peer dep at ${rootNode.locator}`);

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

        for (const [name, locator] of node.hoistedDepNames.entries()) {
          const rootDepLocator = rootNode.depLocators.get(name);
          if (rootDepLocator !== locator) {
            if (DEBUG)
              node.log.push(`${logPrefix} root node has ${rootDepLocator} instead of ${locator} - cannot be hoisted`);
            isHoistedDepsSatisfied = false;
            break;
          }
        }

        isHoistable = isHoistedDepsSatisfied;
      }

      if (isHoistable) {
        const unsatisfiedPeerIds = new Set<NodeId>();
        for (const name of node.peerNames) {
          const peerNodeId = parentNode.depNameToId.get(name)!;
          if (parentNode.deps.has(peerNodeId)) {
            unsatisfiedPeerIds.add(peerNodeId);
          }
        }
        if (unsatisfiedPeerIds.size > 0) {
          isHoistable = false;
          if (DEBUG)
            node.log.push(`${logPrefix} parent node ${parentNode.locator} has unhoisted peers ${Array.from(unsatisfiedPeerIds)}`);
          let peerCandidates = hoistCandidatesWithPeers.get(node.name);
          if (!peerCandidates)
            peerCandidates = new Map();
          hoistCandidatesWithPeers.set(node.name, peerCandidates);
          let peerCandidateInfo = peerCandidates.get(nodeId);
          if (!peerCandidateInfo) {
            peerCandidateInfo = {locator: node.locator, peers: new Map()};
            peerCandidates.set(nodeId, peerCandidateInfo);
          }
          peerCandidateInfo.peers.set(parentId, unsatisfiedPeerIds);
        }
      }

      if (DEBUG && isHoistable) {
        if (competitorInfo && isPreferred) {
          node.log.push(`${logPrefix} is more popular than ${competitorInfo!.locator}(${weight} vs ${competitorInfo!.weight}) added to candidates`);
        } else {
          // node.log.push(`${logPrefix} added to hoist candidates`);
        }
      }
    }

    if (isHoistable) {
      hoistCandidatesWithPeers.delete(node.name);
      let hoistCandidate = hoistCandidates.get(node.name);
      if (!hoistCandidate || (competitorInfo && competitorInfo.locator !== node.locator)) {
        hoistCandidate = {locator: node.locator, nodeIds: new Set(), weight, hoistableFrom: new Set()};
        hoistCandidates.set(node.name, hoistCandidate);
      }
      hoistCandidate.nodeIds.add(nodeId);
      hoistCandidate.hoistableFrom.add(parentId);
    }
  };

  const parentNodeNames = new Map([[rootNode.name, rootNode.locator], ...rootNode.depLocators.entries(), ...rootNode.hoistedDepNames.entries()]);
  for (const depId of rootNode.deps) {
    const dep = tree.get(depId)!;
    for (const subDepId of dep.deps) {
      computeHoistCandidates(depId, subDepId, parentNodeNames);
    }
  }

  // console.log(`${require('util').inspect(hoistCandidates, {depth: null})} ${require('util').inspect(hoistCandidatesWithPeers, {depth: null})}`);

  const candidateIds = new Set<NodeId>();
  for (const candidateInfo of hoistCandidates.values())
    for (const nodeId of candidateInfo.nodeIds)
      candidateIds.add(nodeId);

  const newHoistCandidates: HoistCandidateMap = new Map();
  do {
    for (const [name, peerCandidates] of hoistCandidatesWithPeers.entries()) {
      for (const [nodeId, peerCandidateInfo] of peerCandidates.entries()) {
        for (const [parentId, peers] of peerCandidateInfo.peers.entries()) {
          let peersHoisted = true;
          for (const peerId of peers) {
            if (!candidateIds.has(peerId)) {
              peersHoisted = false;
              break;
            }
          }
          if (peersHoisted) {
            const ancestorNode = ancestorMap.get(peerCandidateInfo.locator)!;
            const weight = ancestorNode.direct.size + ancestorNode.indirect.size;
            const competitorInfo = newHoistCandidates.get(name);
            let hoistCandidate = newHoistCandidates.get(name);
            if (!hoistCandidate || (competitorInfo && competitorInfo.locator !== peerCandidateInfo.locator)) {
              hoistCandidate = {locator: peerCandidateInfo.locator, nodeIds: new Set(), weight, hoistableFrom: new Set()};
              newHoistCandidates.set(name, hoistCandidate);
            }
            hoistCandidate.nodeIds.add(nodeId);
            hoistCandidate.hoistableFrom.add(parentId);
          }
        }
      }
    }

    for (const [name, candidateInfo] of newHoistCandidates) {
      hoistCandidates.set(name, candidateInfo);
      for (const nodeId of candidateInfo.nodeIds)
        candidateIds.add(nodeId);
      hoistCandidatesWithPeers.delete(name);
    }
    newHoistCandidates.clear();
  } while (newHoistCandidates.size > 0);

  const candidates = new Set<HoistCandidate>();
  for (const [name, {hoistableFrom}] of hoistCandidates.entries())
    candidates.add({name, hoistableFrom});

  // console.log(`${rootId} hoistCands: ${hoistCandidates.size > 10 ? hoistCandidates.size : require('util').inspect(hoistCandidates, {depth: null})}, hoistCandsWithPeers: ${hoistCandidatesWithPeers.size}`);

  return candidates;
};

/**
 * Creates a clone of package tree with extra fields used for hoisting purposes.
 *
 * @param tree package tree clone
 */
const cloneTree = (tree: HoisterTree): HoisterWorkTree => {
  const treeCopy = new Map();

  const seenIds = new Set();

  const copySubTree = (nodeId: NodeId) => {
    if (seenIds.has(nodeId))
      return;
    seenIds.add(nodeId);

    const node = tree.get(nodeId)!;
    const {name, reference, deps, peerNames, ...meta} = node;
    const workNode: any = {
      name,
      reference,
      locator: makeLocator(name, reference),
      deps: new Set(),
      depLocators: new Map(),
      depNameToId: new Map(),
      hoistedDepNames: new Map(),
      log: [],
      peerNames: new Set(node.peerNames),
    };
    for (const [key, val] of Object.entries(meta))
      workNode[key] = new Set([val]);

    treeCopy.set(nodeId, workNode);

    for (const depId of node.deps) {
      if (depId !== nodeId) {
        copySubTree(depId);
        workNode.deps.add(depId);
      }
    }
  };

  copySubTree('.');

  for (const node of treeCopy.values()) {
    for (const depId of node.deps) {
      const dep = treeCopy.get(depId)!;
      node.depLocators.set(dep.name, dep.locator);
      node.depNameToId.set(dep.name, depId);
    }
  }

  return treeCopy;
};

/**
 * Creates a clone of hoisted package tree with extra fields removed
 *
 * @param tree stripped down hoisted package tree clone
 */
const shrinkTree = (tree: HoisterWorkTree): HoisterResult => {
  const treeCopy = new Map();
  const idMap = new Map();

  if (DEBUG)
    console.log(require('util').inspect(tree, {depth: null, maxArrayLength: null}));

  const seenIds = new Set();
  const addNode = (srcNodeId: NodeId, parentNode?: HoisterResultNode) => {
    const node = tree.get(srcNodeId)!;
    const {name, reference, log, locator, deps, depLocators, depNameToId, hoistedDepNames, peerNames, ...meta} = node;
    let locatorMap = idMap.get(locator);
    if (!locatorMap) {
      locatorMap = new Map();
      idMap.set(locator, locatorMap);
    }
    let dstNodeId = srcNodeId === '.' ? '.' : locatorMap.get(srcNodeId);
    if (!dstNodeId) {
      dstNodeId = `${reference === '' ? name : locator}${locatorMap.size === 0 ? '' : `$${locatorMap.size}`}`;
      locatorMap.set(srcNodeId, dstNodeId);
    }
    const newNode = {
      name, reference, deps: new Set<NodeId>(), ...meta,
    };
    if (parentNode)
      parentNode.deps.add(dstNodeId);

    if (seenIds.has(srcNodeId))
      return;
    seenIds.add(srcNodeId);

    treeCopy.set(dstNodeId, newNode);
    for (const depId of node.deps) {
      const depNode = tree.get(depId)!;
      if (!peerNames.has(depNode.name)) {
        addNode(depId, newNode);
      }
    }
  };

  addNode('.');

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

  const seenIds = new Set<NodeId>();

  const addAncestor = (parentLocators: Locator[], nodeId: NodeId) => {
    if (seenIds.has(nodeId))
      return;
    seenIds.add(nodeId);

    const pkg = tree.get(nodeId)!;

    for (const depPkgId of pkg.deps) {
      const depPkg = tree.get(depPkgId)!;
      let ancestorNode = ancestorMap.get(depPkg.locator);
      if (!ancestorNode) {
        ancestorNode = {direct: new Set(), indirect: new Set(parentLocators)};
        ancestorMap.set(depPkg.locator, ancestorNode);
      }

      ancestorNode.direct.add(pkg.locator);

      addAncestor([...parentLocators, depPkg.locator], depPkgId);
    }
  };

  addAncestor([], '.');

  return ancestorMap;
};
