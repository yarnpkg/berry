type NodeId = string;
type PackageName = string;
export type HoisterTreeNode = {name: PackageName, reference: string, deps: Set<NodeId>, peerNames: Set<PackageName>, [meta: string]: any};
export type HoisterTree = Map<NodeId, HoisterTreeNode>;
export type HoisterResult = Map<NodeId, HoisterResultNode>;
export type HoisterResultNode = {name: PackageName, reference: string, deps: Set<NodeId>, [meta: string]: any};
type HoisterWorkNode = {name: PackageName, reference: string, locator: Locator, deps: Set<NodeId>, depNames: Map<PackageName, Locator>, hoistedDepNames: Map<PackageName, Locator>, peerNames: Set<PackageName>, [meta: string]: any};
type HoisterWorkTree = Map<NodeId, HoisterWorkNode>;

type Locator = string;

type HoistCandidateSet = {treePath: NodeId[], candidates: Map<Locator, NodeId>};

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

  lastNodeId = 0;
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

  const rootNode = tree.get(rootId)!;
  const hoistedPackages = new Map<Locator, Map<string, NodeId[]>>();

  do {
    const remapedMap = new Map<NodeId, NodeId>();
    const findNodeId = (origId: NodeId, deps: Set<NodeId>): NodeId | undefined => {
      let candId: NodeId | undefined = origId;
      do {
        if (deps.has(candId))
          return candId;
        candId = remapedMap.get(candId);
      } while (candId);
      return candId;
    };

    packagesToHoist = getHoistablePackages(tree, rootId, ancestorMap);
    for (const {treePath, candidates} of packagesToHoist) {
      let locatorPath = '';
      let idx;
      let prevNode: HoisterWorkNode;
      for (idx = 0; idx < treePath.length - 1; idx++) {
        const parentNodeId = idx === 0 ? treePath[idx] : findNodeId(treePath[idx], prevNode!.deps);
        if (!parentNodeId)
          break;
        const parentNode = tree.get(parentNodeId)!;
        prevNode = parentNode;
        locatorPath += (idx === 0 ? '' : '>') + parentNode.locator;
        const origNodeId = treePath[idx + 1];
        const nodeId = findNodeId(origNodeId, parentNode.deps);
        if (!nodeId)
          break;

        let node = tree.get(nodeId)!;
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

        if (idx === treePath.length - 2) {
          for (const [hoistedLocator, origHoistedNodeId] of candidates.entries()) {
            const hoistedNodeId = findNodeId(origHoistedNodeId, node.deps);
            if (!hoistedNodeId)
              break;
            const hoistedNode = tree.get(hoistedNodeId)!;
            locatorPath += `>${node.locator}`;

            // Delete hoisted node from parent node
            node.deps.delete(hoistedNodeId);
            node.depNames.delete(hoistedNode.name);
            node.hoistedDepNames.set(hoistedNode.name, hoistedNode.locator);

            // Add hoisted node to root node, in case it is not already there
            if (!rootNode.depNames.has(hoistedNode.name)) {
              rootNode.deps.add(hoistedNodeId);
              rootNode.depNames.set(hoistedNode.name, hoistedNode.locator);
            }

            let hoistedPackagesNode = hoistedPackages.get(hoistedLocator)!;
            if (!hoistedPackages.get(hoistedLocator)) {
              hoistedPackagesNode = new Map();
              hoistedPackages.set(hoistedLocator, hoistedPackagesNode);
            }
            if (hoistedPackagesNode.has(locatorPath))
              throw new Error(`Assertion failed. Package ${hoistedLocator} has already been hoisted from ${locatorPath} previously`);

            hoistedPackagesNode.set(locatorPath, treePath);
          }
        }
      }
    }
  } while (packagesToHoist.length > 0);
  for (const depId of rootNode.deps) {
    hoistTo(tree, depId, ancestorMap);
  }
};

const getHoistablePackages = (tree: HoisterWorkTree, rootId: NodeId, ancestorMap: AncestorMap): HoistCandidateSet[] => {
  const hoistCandidatePaths = new Map<NodeId[], Map<Locator, NodeId>>();
  const hoistedPackageNames = new Map<PackageName, { locator: Locator, weight: number, hoistPaths: Set<NodeId[]> }>();

  const seenIds = new Set<NodeId>([rootId]);
  const rootNode = tree.get(rootId)!;

  const computeHoistCandidates = (nodePath: NodeId[], nodeId: NodeId, parentNodeNames: Map<string, Locator>) => {
    if (seenIds.has(nodeId))
      return;
    seenIds.add(nodeId);

    const node = tree.get(nodeId)!;
    const sameParentNodeNameLocator = parentNodeNames.get(node.name);
    const parentNodeId = nodePath[nodePath.length - 1];
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
    const competitorInfo = hoistedPackageNames.get(node.name);
    const ancestorNode = ancestorMap.get(node.locator)!;
    const weight = ancestorNode.direct.size + ancestorNode.indirect.size;
    if (isHoistable)
      // If there is a competitor package to be hoisted, we should prefer the package with more usage
      isHoistable = !competitorInfo || competitorInfo.weight < weight;

    if (isHoistable) {
      if (!competitorInfo || competitorInfo.locator !== node.locator) {
        if (competitorInfo) {
          for (const hoistPath of competitorInfo.hoistPaths) {
            const locatorMap = hoistCandidatePaths.get(hoistPath)!;
            if (locatorMap.size === 1) {
              hoistCandidatePaths.delete(hoistPath);
            } else {
              locatorMap.delete(competitorInfo.locator);
            }
          }
        }
        hoistedPackageNames.set(node.name, {locator: node.locator, weight, hoistPaths: new Set()});
      }
      let locatorMap = hoistCandidatePaths.get(nodePath);
      if (!locatorMap) {
        locatorMap = new Map();
        hoistCandidatePaths.set(nodePath, locatorMap);
      }
      locatorMap.set(node.locator, nodeId);
      hoistedPackageNames.get(node.name)!.hoistPaths.add(nodePath);
    } else {
      for (const depId of node.deps) {
        computeHoistCandidates([...nodePath, nodeId], depId, new Map([...parentNodeNames.entries(), [node.name, node.locator]]));
      }
    }
  };

  const parentNodeNames = new Map([...rootNode.depNames.entries(), ...rootNode.hoistedDepNames.entries()]);
  for (const depId of rootNode.deps) {
    const dep = tree.get(depId)!;
    for (const subDepId of dep.deps) {
      computeHoistCandidates([rootId, depId], subDepId, parentNodeNames);
    }
  }

  return Array.from(hoistCandidatePaths.entries())
    .map(
      ([treePath, candidates]) => ({treePath, candidates})
    );
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

  const addNode = (srcNodeId: NodeId, parentNode?: HoisterResultNode): string => {
    const node = tree.get(srcNodeId)!;
    const {name, reference, locator, deps, depNames, hoistedDepNames, peerNames, ...meta} = node;
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

    treeCopy.set(dstNodeId, newNode);
    for (const depId of node.deps) {
      const depNode = tree.get(depId)!;
      if (!peerNames.has(depNode.name)) {
        addNode(depId, newNode);
      }
    }

    return dstNodeId;
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
