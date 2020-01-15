type NodeId = string;
type PackageName = string;
export type HoisterTreeNode = {name: PackageName, reference: string, deps: Set<NodeId>, peerNames: Set<PackageName>, [meta: string]: any};
export type HoisterTree = Map<NodeId, HoisterTreeNode>;
export type HoisterResult = Map<NodeId, HoisterResultNode>;
export type HoisterResultNode = {name: PackageName, reference: string, deps: Set<NodeId>, [meta: string]: any};
type HoisterWorkNode = {name: PackageName, reference: string, locator: Locator, deps: Set<NodeId>, depNames: Map<PackageName, Locator>, hoistedDepNames: Map<PackageName, Locator>, peerNames: Set<PackageName>, [meta: string]: any};
type HoisterWorkTree = Map<NodeId, HoisterWorkNode>;

type Locator = string;

/**
 * Mapping which packages depend on a given package. It is used to determine hoisting weight,
 * e.g. which one among the group of packages with the same name should be hoisted.
 * The package having the biggest number of ancestors using this package will be hoisted.
 */
type AncestorMap = Map<Locator, { direct: Set<Locator>, indirect: Set<Locator>}>;

const makeLocator = (name: string, reference: string) => `${name}@${reference}`;

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

  hoistTo(treeCopy, '.', ancestorMap);

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
const hoistTo = (tree: HoisterWorkTree, rootId: NodeId, ancestorMap: AncestorMap) => {
  let packagesToHoist;
  let lastNodeId = 0;

  const rootNode = tree.get(rootId)!;

  let MAX_ITER = 100;
  let iter = 0;
  do {
    const remapedMap = new Map<NodeId, NodeId>();
    const getNodeId = (id: NodeId) => remapedMap.get(id) || id;

    packagesToHoist = getHoistablePackages(tree, rootId, ancestorMap);
    for (const nodePath of packagesToHoist) {
      for (let idx = 0; idx < nodePath.length - 2; idx++) {
        const parentNodeId = getNodeId(nodePath[idx]);
        const parentNode = tree.get(parentNodeId)!;
        const origNodeId = nodePath[idx + 1];
        const nodeId = getNodeId(origNodeId);
        let node = tree.get(nodeId)!;
        if (nodeId === origNodeId && parentNode.deps.has(nodeId)) {
          const {name, reference, locator, deps, depNames, hoistedDepNames, peerNames, ...meta} = node;
          const depCopy = new Set(deps);
          const depNamesCopy = new Map(depNames);
          const hoistedDepNamesCopy = new Map(hoistedDepNames);

          const nodeCopy: HoisterWorkNode = {
            name,
            reference,
            locator,
            deps: depCopy,
            depNames: depNamesCopy,
            hoistedDepNames: hoistedDepNamesCopy,
            peerNames: new Set(peerNames),
            ...meta,
          };
          const newNodeId = `${lastNodeId++}`;
          parentNode.deps.delete(nodeId);
          parentNode.deps.add(newNodeId);
          tree.set(newNodeId, nodeCopy);
          remapedMap.set(nodeId, newNodeId);
          node = nodeCopy;
        }

        if (idx === nodePath.length - 3) {
          const hoistedNodeId = getNodeId(nodePath[nodePath.length - 1]);
          const hoistedNode = tree.get(hoistedNodeId)!;

          // Delete hoisted node from parent node
          node.deps.delete(hoistedNodeId);
          node.depNames.delete(hoistedNode.name);
          node.hoistedDepNames.set(hoistedNode.name, hoistedNode.locator);

          // Add hoisted node to root node
          rootNode.deps.add(hoistedNodeId);
          rootNode.depNames.set(hoistedNode.name, hoistedNode.locator);
        }
      }
    }
  } while (packagesToHoist.size > 0 && iter++ < MAX_ITER);
  if (iter >= MAX_ITER)
    throw new Error('Assertion failed. Too many hoising iterations reached!');
  for (const depId of rootNode.deps) {
    hoistTo(tree, depId, ancestorMap);
  }
};

const getHoistablePackages = (tree: HoisterWorkTree, rootId: NodeId, ancestorMap: AncestorMap): Set<NodeId[]> => {
  const packagesToHoist = new Map<PackageName, { locator: Locator, weight: number, candidates: Set<NodeId[]> }>();

  const seenIds = new Set<NodeId>([rootId]);
  const rootNode = tree.get(rootId)!;

  const computeHoistCandidates = (nodePath: NodeId[], parentNodeNames: Map<string, Locator>) => {
    const nodeId = nodePath[nodePath.length - 1];
    if (seenIds.has(nodeId))
      return;
    seenIds.add(nodeId);

    const node = tree.get(nodeId)!;
    const sameParentNodeNameLocator = parentNodeNames.get(node.name);
    const parentNodeId = nodePath[nodePath.length - 2];
    const parentNode = tree.get(parentNodeId)!;

    let arePeerDepsSatisfied = true;
    for (const name of node.peerNames) {
      if (parentNode.depNames.has(name)) {
        arePeerDepsSatisfied = false;
        break;
      }
    }

    const isNameAvailable = arePeerDepsSatisfied && (!sameParentNodeNameLocator || sameParentNodeNameLocator === node.locator);
    const isRegularDep = isNameAvailable && !rootNode.peerNames.has(node.name);
    let isHoistable = isRegularDep;
    const competitorInfo = packagesToHoist.get(node.name);
    const ancestorNode = ancestorMap.get(node.locator)!;
    const weight = ancestorNode.direct.size + ancestorNode.indirect.size;
    if (isHoistable)
      // If there is a competitor package to be hoisted, we should prefer the package with more usage
      isHoistable = !competitorInfo || competitorInfo.weight < weight;

    if (isHoistable) {
      if (!competitorInfo || competitorInfo.locator !== node.locator) {
        packagesToHoist.set(node.name, {locator: node.locator, weight, candidates: new Set([nodePath])});
      } else {
        packagesToHoist.get(node.name)!.candidates.add(nodePath);
      }
    }
    for (const depId of node.deps) {
      computeHoistCandidates([...nodePath, depId], new Map([...parentNodeNames.entries(), [node.name, node.locator]]));
    }
  };

  const parentNodeNames = new Map([...rootNode.depNames.entries(), ...rootNode.hoistedDepNames.entries()]);
  for (const depId of rootNode.deps) {
    const dep = tree.get(depId)!;
    for (const subDepId of dep.deps) {
      computeHoistCandidates([rootId, depId, subDepId], parentNodeNames);
    }
  }

  const candidates = new Set<NodeId[]>();
  packagesToHoist.forEach(pkg => pkg.candidates.forEach(candidate => candidates.add(candidate)));

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
    const workNode = {
      name,
      reference,
      locator: makeLocator(name, reference),
      deps: new Set(),
      depNames: new Map(),
      hoistedDepNames: new Map(),
      peerNames: new Set(node.peerNames),
      ...meta,
    };
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
      node.depNames.set(dep.name, dep.locator);
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

  const addNode = (nodeId: NodeId, parentNode?: HoisterResultNode): string => {
    const node = tree.get(nodeId)!;
    const {name, reference, locator, deps, depNames, hoistedDepNames, peerNames, ...meta} = node;
    let locatorMap = idMap.get(locator);
    if (!locatorMap) {
      locatorMap = new Map();
      idMap.set(locator, locatorMap);
    }
    let key = locatorMap.get(nodeId);
    if (!key) {
      key = `${reference === '' ? name : locator}${locatorMap.size === 0 ? '' : `$${locatorMap.size}`}`;
      locatorMap.set(nodeId, key);
    }
    const newNode = {
      name, reference, deps: new Set<NodeId>(), ...meta,
    };
    if (parentNode)
      parentNode.deps.add(key);

    treeCopy.set(key, newNode);
    for (const depId of node.deps) {
      const depNode = tree.get(depId)!;
      if (!peerNames.has(depNode.name)) {
        addNode(depId, newNode);
      }
    }

    return key;
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
