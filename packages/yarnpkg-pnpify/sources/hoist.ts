type PackageName = string;
export type HoisterTree = {name: PackageName, reference: string, dependencies: Set<HoisterTree>, peerNames: Set<PackageName>};
export type HoisterResult = {name: PackageName, references: Set<string>, dependencies: Set<HoisterResult>};
type Locator = string;
type Ident = string;
type HoisterWorkTree = {name: PackageName, references: Set<string>, ident: Ident, locator: Locator, dependencies: Map<PackageName, HoisterWorkTree>, originalDependencies: Map<PackageName, HoisterWorkTree>, hoistedDependencies: Map<PackageName, HoisterWorkTree>, peerNames: ReadonlySet<PackageName>, reasons: Map<PackageName, {root: HoisterWorkTree, reason: string}>};

type Tuple = {
  node: HoisterWorkTree,
  parent: HoisterWorkTree,
}

type CloneTree = {clone: HoisterWorkTree, children: Map<HoisterWorkTree, CloneTree>};

type HoistCandidate = { nodePath: Array<HoisterWorkTree>, node: HoisterWorkTree };
type HoistCandidateSet = {node: HoisterWorkTree, weight: number, candidates: Set<HoistCandidate>};

type HoistCandidates = Map<PackageName, HoistCandidateSet>;

/**
 * Mapping which packages depend on a given package. It is used to determine hoisting weight,
 * e.g. which one among the group of packages with the same name should be hoisted.
 * The package having the biggest number of ancestors using this package will be hoisted.
 */
type AncestorMap = Map<Ident, Set<Ident>>;

const makeLocator = (name: string, reference: string) => `${name}@${reference}`;
const makeIdent = (name: string, reference: string) => {
  const hashIdx = reference.indexOf(`#`);
  // Strip virtual reference part, we don't need it for hoisting purposes
  const realReference = hashIdx >= 0 ? reference.substring(hashIdx + 1) : reference!;
  return makeLocator(name, realReference);
};

type HoistOptions = {
  check?: boolean;
  debugLevel?: number;
}

type InternalHoistOptions = {
  check?: boolean;
  debugLevel: number;
}

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
export const hoist = (tree: HoisterTree, opts: HoistOptions = {}): HoisterResult => {
  const debugLevel = opts.debugLevel || Number(process.env.NM_DEBUG_LEVEL || -1);
  const check = opts.check || debugLevel >= 9;
  const options: InternalHoistOptions = {check, debugLevel};

  if (options.debugLevel >= 0)
    console.time(`hoist`);

  const treeCopy = cloneTree(tree);
  const ancestorMap = buildAncestorMap(treeCopy);

  hoistTo(treeCopy, treeCopy, new Set([treeCopy.locator]), new Map(), ancestorMap, options);

  if (options.debugLevel >= 0)
    console.timeEnd(`hoist`);

  if (options.debugLevel >= 3) {
    const identList = Array.from(ancestorMap.keys());
    identList.sort((key1, key2) => ancestorMap.get(key2)!.size - ancestorMap.get(key1)!.size);
    console.log(`Package popularity:`);
    for (const ident of identList) {
      console.log(ident, `→`, ancestorMap.get(ident)!.size);
    }
  }

  if (options.debugLevel >= 1) {
    const checkLog = selfCheck(treeCopy);
    if (checkLog) {
      throw new Error(`${checkLog}, after hoisting finished:\n${dumpDepTree(treeCopy)}`);
    }
  }

  if (options.debugLevel >= 2)
    console.log(dumpDepTree(treeCopy));

  return shrinkTree(treeCopy);
};

const getHoistedDependencies = (rootNode: HoisterWorkTree): Map<PackageName, HoisterWorkTree> => {
  const hoistedDependencies = new Map();
  const seenNodes = new Set<HoisterWorkTree>();

  const addHoistedDependencies = (node: HoisterWorkTree) => {
    if (seenNodes.has(node))
      return;
    seenNodes.add(node);

    for (const dep of node.hoistedDependencies.values())
      if (!rootNode.dependencies.has(dep.name))
        hoistedDependencies.set(dep.name, dep);

    for (const dep of node.dependencies.values()) {
      if (!node.peerNames.has(dep.name)) {
        addHoistedDependencies(dep);
      }
    }
  };

  addHoistedDependencies(rootNode);

  return hoistedDependencies;
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
 * on tree branches of packages at a time:
 * `root package` -> `parent package 1` ... `parent package n` -> `dependency`
 * We check wether we can hoist `dependency` to `root package`, this boils down basically
 * to checking:
 * 1. Wether `root package` does not depend on other version of `dependency`
 * 2. Wether all the peer dependencies of a `dependency` had already been hoisted from all `parent packages`
 *
 * If many versions of the `dependency` can be hoisted to the `root package` we choose the most used
 * `dependency` version in the project among them.
 *
 * This function mutates the tree.
 *
 * @param tree package dependencies graph
 * @param rootNode root node to hoist to
 * @param rootNodePath root node path in the tree
 * @param parentAncestorDependencies commulative dependencies of all root node ancestors, excluding root node dependenciew
 * @param ancestorMap ancestor map
 * @param options hoisting options
 */
const hoistTo = (tree: HoisterWorkTree, rootNode: HoisterWorkTree, rootNodePath: Set<Locator>, parentAncestorDependencies: Map<PackageName, HoisterWorkTree>, ancestorMap: AncestorMap, options: InternalHoistOptions, seenNodes: Set<HoisterWorkTree> = new Set()) => {
  if (seenNodes.has(rootNode))
    return;
  seenNodes.add(rootNode);

  const ancestorDependencies = new Map(parentAncestorDependencies);
  for (const dep of rootNode.dependencies.values())
    if (!rootNode.peerNames.has(dep.name))
      ancestorDependencies.set(dep.name, dep);

  const hoistedDependencies = rootNode === tree ? new Map() : getHoistedDependencies(rootNode);

  const clonedTree: CloneTree = {clone: rootNode, children: new Map()};
  let hoistCandidates;
  do {
    hoistCandidates = getHoistCandidates(rootNode, rootNodePath, ancestorDependencies, hoistedDependencies, ancestorMap, options);
    for (const hoistSet of hoistCandidates) {
      for (const {nodePath, node} of hoistSet.candidates) {
        let parentClonedNode = clonedTree;
        for (const originalNode of nodePath) {
          let nodeClone = parentClonedNode.children.get(originalNode);
          if (!nodeClone) {
            const {name, references, ident, locator, dependencies, originalDependencies, hoistedDependencies, peerNames, reasons} = originalNode;
            // To perform node hoisting from parent node we must clone parent nodes up to the root node,
            // because some other package in the tree might depend on the parent package where hoisting
            // cannot be performed
            const clone = {
              name,
              references: new Set(references),
              ident,
              locator,
              dependencies: new Map(dependencies),
              originalDependencies: new Map(originalDependencies),
              hoistedDependencies: new Map(hoistedDependencies),
              peerNames: new Set(peerNames),
              reasons: new Map(reasons),
            };
            nodeClone = {clone, children: new Map()};
            const selfDep = clone.dependencies.get(name);
            if (selfDep && selfDep.ident == clone.ident)
              // Update self-reference
              clone.dependencies.set(name, clone);
            parentClonedNode.children.set(originalNode, nodeClone);
            parentClonedNode.clone.dependencies.set(name, clone);
          }
          parentClonedNode = nodeClone;
        }
        parentClonedNode.clone.dependencies.delete(node.name);
        parentClonedNode.clone.hoistedDependencies.set(node.name, node);
        parentClonedNode.clone.reasons.delete(node.name);
        const hoistedNode = rootNode.dependencies.get(node.name);
        // Add hoisted node to root node, in case it is not already there
        if (!hoistedNode) {
          // Avoid adding other version of root node to itself
          if (rootNode.ident !== node.ident) {
            rootNode.dependencies.set(node.name, node);
            ancestorDependencies.set(node.name, node);
          }
        } else {
          for (const reference of node.references) {
            hoistedNode.references.add(reference);
          }
        }
        if (options.check) {
          const checkLog = selfCheck(tree);
          if (checkLog) {
            throw new Error(`${checkLog}, after hoisting ${[rootNode, ...nodePath, node].map(x => prettyPrintLocator(x.locator)).join(`→`)}:\n${dumpDepTree(tree)}`);
          }
        }
      }
    }
  } while (hoistCandidates.size > 0);

  for (const dependency of rootNode.dependencies.values()) {
    if (!rootNode.peerNames.has(dependency.name) && !rootNodePath.has(dependency.locator)) {
      rootNodePath.add(dependency.locator);
      hoistTo(tree, dependency, rootNodePath, ancestorDependencies, ancestorMap, options);
      rootNodePath.delete(dependency.locator);
    }
  }
};

/**
 * Finds all the packages that can be hoisted to the root package node from the set of:
 * `root node` -> ... `parent dependency j` ... -> `dependency` -> `subdependency`
 *
 * @param rootNode root package node
 * @param rootNodePath root node path in the tree
 * @param ancestorDependencies commulative dependencies of all root node ancestors, including root node dependencies
 * @param ancestorMap ancestor map to determine `dependency` version popularity
 */
const getHoistCandidates = (rootNode: HoisterWorkTree, rootNodePath: Set<Locator>, ancestorDependencies: Map<PackageName, HoisterWorkTree>, hoistedDependencies: Map<PackageName, HoisterWorkTree>, ancestorMap: AncestorMap, options: InternalHoistOptions): Set<HoistCandidateSet> => {
  const hoistCandidates: HoistCandidates = new Map();
  const parents: Array<Tuple> = [];
  const seenNodes = new Set<HoisterWorkTree>();

  const computeHoistCandidates = (nodePath: Array<HoisterWorkTree>, locatorPath: Array<Locator>, node: HoisterWorkTree) => {
    const isSeen = seenNodes.has(node);

    let reasonRoot;
    let reason: string;
    if (options.debugLevel >= 2)
      reasonRoot = `${Array.from(rootNodePath).map(x => prettyPrintLocator(x)).join(`→`)}`;

    let isHoistable = true;
    if (isHoistable) {
      const isRegularDepAtRoot = !rootNode.peerNames.has(node.name);
      if (options.debugLevel >= 2 && !isRegularDepAtRoot)
        reason = `- is a peer dependency at ${reasonRoot}`;
      isHoistable = isRegularDepAtRoot;
    }

    let competitorInfo;
    let weight: number;
    let rootDep;

    if (isHoistable) {
      const isCompatibleIdent = (rootNode.name !== node.name || rootNode.ident === node.ident);
      if (options.debugLevel >= 2 && !isCompatibleIdent)
        reason = `- conflicts with ${reasonRoot}`;

      isHoistable = isCompatibleIdent;
    }

    if (isHoistable) {
      let isNameAvailable = false;
      const hoistedDep = hoistedDependencies.get(node.name);
      isNameAvailable = (!hoistedDep || hoistedDep.ident === node.ident);
      if (options.debugLevel >= 2 && !isNameAvailable)
        reason = `- filled by: ${prettyPrintLocator(hoistedDep!.locator)} at ${reasonRoot}`;
      if (isNameAvailable) {
        for (const tuple of parents) {
          const parentDep = tuple.parent.dependencies.get(node.name);
          if (parentDep && parentDep.ident !== node.ident) {
            isNameAvailable = false;
            if (options.debugLevel >= 2)
              reason = `- filled by: ${prettyPrintLocator(parentDep!.locator)} at ${prettyPrintLocator(tuple.parent.locator)}`;
            break;
          }
        }
      }

      isHoistable = isNameAvailable;
    }

    if (isHoistable) {
      competitorInfo = hoistCandidates.get(node.name);
      weight = ancestorMap.get(node.ident)!.size;
      // If there is a competitor package to be hoisted, we should prefer the package with more usage
      const isPreferred = !competitorInfo || competitorInfo.weight <= weight;
      if (options.debugLevel >= 2 && !isPreferred)
        reason = `- preferred package ${competitorInfo!.node.locator} at ${reasonRoot}`;
      isHoistable = isPreferred;
    }

    if (isHoistable && !rootDep) {
      let areRegularDepsSatisfied = true;
      // Check that hoisted dependencies of current node are satisifed
      for (const dep of node.hoistedDependencies.values()) {
        if (node.originalDependencies.has(dep.name)) {
          const depNode = ancestorDependencies.get(dep.name);
          if (!depNode) {
            if (options.debugLevel >= 2)
              reason = `- hoisted dependency ${prettyPrintLocator(dep.locator)} is absent at ${reasonRoot}`;
            areRegularDepsSatisfied = false;
          } else if (depNode.ident !== dep.ident) {
            if (options.debugLevel >= 2)
              reason = `- hoisted dependency ${prettyPrintLocator(dep.locator)} has a clash with ${prettyPrintLocator(depNode.locator)} at ${reasonRoot}`;
            areRegularDepsSatisfied = false;
          }
        }
        if (!areRegularDepsSatisfied) {
          break;
        }
      }
      isHoistable = areRegularDepsSatisfied;
    }

    if (isHoistable) {
      let arePeerDepsSatisfied = true;
      const checkList = new Set(node.peerNames);
      for (let idx = parents.length - 1; idx >= 0; idx--) {
        const parent = parents[idx].node;
        for (const name of checkList) {
          if (parent.peerNames.has(name))
            continue;

          const parentDepNode = parent.dependencies.get(name);
          if (parentDepNode) {
            if (options.debugLevel >= 2)
              reason = `- peer dependency ${prettyPrintLocator(parentDepNode.locator)} from parent ${prettyPrintLocator(parent.locator)} was not hoisted to ${reasonRoot}`;
            arePeerDepsSatisfied = false;
            break;
          }
          checkList.delete(name);
        }
        if (!arePeerDepsSatisfied) {
          break;
        }
      }
      isHoistable = arePeerDepsSatisfied;
    }

    if (isHoistable) {
      let hoistCandidate = hoistCandidates.get(node.name);
      if (!hoistCandidate || (competitorInfo && competitorInfo.node.ident !== node.ident)) {
        hoistCandidate = {node, candidates: new Set(), weight: weight!};
        hoistCandidates.set(node.name, hoistCandidate);
      }
      hoistCandidate.candidates.add({nodePath, node});
    } else if (options.debugLevel >= 2) {
      const parent = parents[parents.length - 1].node;
      const prevReason = parent.reasons.get(node.name);
      if (!prevReason || prevReason.root === rootNode) {
        parent.reasons.set(node.name, {reason: reason!, root: rootNode});
      }
    }

    if (!isSeen && locatorPath.indexOf(node.locator) < 0) {
      seenNodes.add(node);
      const parent = parents[parents.length - 1].node;
      const tuple = {parent, node};
      parents.push(tuple);
      for (const dep of node.dependencies.values())
        if (!node.peerNames.has(dep.name))
          computeHoistCandidates([...nodePath, node], [...locatorPath, node.locator], dep);

      parents.pop();
    }
  };

  for (const dep of rootNode.dependencies.values()) {
    if (rootNode.peerNames.has(dep.name) || dep.locator === rootNode.locator)
      continue;
    const tuple = {parent: rootNode, node: dep};
    parents.push(tuple);
    for (const subDep of dep.dependencies.values())
      if (!dep.peerNames.has(subDep.name) && subDep.locator !== dep.locator)
        computeHoistCandidates([dep], [rootNode.locator, dep.locator], subDep);

    parents.pop();
  }

  return new Set(hoistCandidates.values());
};

const selfCheck = (tree: HoisterWorkTree): string => {
  const log: Array<string> = [];

  const seenNodes = new Set();
  const parents = new Set<HoisterWorkTree>();

  const checkNode = (node: HoisterWorkTree, parentDeps: Map<PackageName, HoisterWorkTree>) => {
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
      const prettyPrintTreePath = () => `${Array.from(parents).concat([node]).map(x => prettyPrintLocator(x.locator)).join(`→`)}`;
      if (node.peerNames.has(origDep.name)) {
        const parentDep = parentDeps.get(origDep.name);
        if (parentDep !== dep) {
          log.push(`${prettyPrintTreePath()} - broken peer promise: expected ${dep!.locator} but found ${parentDep ? parentDep.locator : parentDep}`);
        }
      } else {
        if (!dep) {
          log.push(`${prettyPrintTreePath()} - broken require promise: no required dependency ${origDep.locator} found`);
        } else if (dep.ident !== origDep.ident) {
          log.push(`${prettyPrintTreePath()} - broken require promise: expected ${origDep.ident}, but found: ${dep.ident}`);
        }
      }
    }

    parents.add(node);
    for (const dep of node.dependencies.values()) {
      if (!node.peerNames.has(dep.name)) {
        checkNode(dep, dependencies);
      }
    }
    parents.delete(node);
  };

  checkNode(tree, tree.dependencies);

  return log.join(`\n`);
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
    ident: makeIdent(name, reference),
    dependencies: new Map(),
    originalDependencies: new Map(),
    hoistedDependencies: new Map(),
    peerNames: new Set(peerNames),
    reasons: new Map(),
  };

  const seenNodes = new Map<HoisterTree, HoisterWorkTree>([[tree, treeCopy]]);

  const addNode = (node: HoisterTree, parentNode: HoisterWorkTree) => {
    // Skip self-references
    let workNode = seenNodes.get(node);
    const isSeen = !!workNode;
    if (!workNode) {
      const {name, reference, peerNames} = node;
      workNode = {
        name,
        references: new Set([reference]),
        locator: makeLocator(name, reference),
        ident: makeIdent(name, reference),
        dependencies: new Map(),
        originalDependencies: new Map(),
        hoistedDependencies: new Map(),
        peerNames: new Set(peerNames),
        reasons: new Map(),
      };
      seenNodes.set(node, workNode);
    }

    parentNode.dependencies.set(workNode.name, workNode);
    parentNode.originalDependencies.set(workNode.name, workNode);

    if (!isSeen) {
      for (const dep of node.dependencies) {
        addNode(dep, workNode);
      }
    }
  };

  for (const dep of tree.dependencies)
    addNode(dep, treeCopy);

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

  const nodes = new Map<Locator, HoisterResult>([[tree.locator, treeCopy]]);

  const addNode = (node: HoisterWorkTree, parentNode: HoisterResult) => {
    let resultNode = nodes.get(node.locator);
    const isSeen = !!resultNode;

    if (!resultNode) {
      const {name, references} = node;
      resultNode = {
        name, references, dependencies: new Set<HoisterResult>(),
      };
    }

    parentNode.dependencies.add(resultNode);

    if (!isSeen) {
      nodes.set(node.locator, resultNode);
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

  const seenNodes = new Set<HoisterWorkTree>([tree]);

  const addParent = (parentNode: HoisterWorkTree, node: HoisterWorkTree) => {
    const isSeen = !!seenNodes.has(node);

    let parents = ancestorMap.get(node.ident);
    if (!parents) {
      parents = new Set<Ident>();
      ancestorMap.set(node.ident, parents);
    }
    parents.add(parentNode.ident);

    if (!isSeen) {
      seenNodes.add(node);
      for (const dep of node.dependencies.values()) {
        if (!node.peerNames.has(dep.name)) {
          addParent(node, dep);
        }
      }
    }
  };

  for (const dep of tree.dependencies.values())
    if (!tree.peerNames.has(dep.name))
      addParent(tree, dep);

  return ancestorMap;
};

const prettyPrintLocator = (locator: Locator) => {
  const idx = locator.indexOf(`@`, 1);
  const name = locator.substring(0, idx);
  const reference = locator.substring(idx + 1);
  if (reference === `workspace:.`) {
    return `.`;
  } else if (!reference) {
    return `${name}`;
  } else {
    const version = (reference.indexOf(`#`) > 0 ? reference.split(`#`)[1] : reference).replace(`npm:`, ``);
    if (reference.startsWith(`virtual`)) {
      return `v:${name}@${version}`;
    } else {
      return `${name}@${version}`;
    }
  }
};

const MAX_NODES_TO_DUMP = 50000;

/**
 * Pretty-prints dependency tree in the `yarn why`-like format
 *
 * The function is used for troubleshooting purposes only.
 *
 * @param pkg node_modules tree
 *
 * @returns sorted node_modules tree
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const dumpDepTree = (tree: HoisterWorkTree) => {
  let nodeCount = 0;
  const dumpPackage = (pkg: HoisterWorkTree, parents: Set<HoisterWorkTree>, prefix = ``): string => {
    if (nodeCount > MAX_NODES_TO_DUMP || parents.has(pkg))
      return ``;

    nodeCount++;
    const dependencies = Array.from(pkg.dependencies.values());

    let str = ``;
    parents.add(pkg);
    for (let idx = 0; idx < dependencies.length; idx++) {
      const dep = dependencies[idx];
      if (!pkg.peerNames.has(dep.name)) {
        const reasonObj = pkg.reasons.get(dep.name);
        str += `${prefix}${idx < dependencies.length - 1 ? `├─` : `└─`}${(parents.has(dep) ? `>` : ``) + prettyPrintLocator(dep.locator) + (reasonObj ? ` ${reasonObj.reason}`: ``)}\n`;
        str += dumpPackage(dep, parents, `${prefix}${idx < dependencies.length - 1 ?`│ ` : `  `}`);
      }
    }
    parents.delete(pkg);
    return str;
  };

  const treeDump = dumpPackage(tree, new Set());

  return treeDump + ((nodeCount > MAX_NODES_TO_DUMP) ? `\nTree is too large, part of the tree has been dunped\n` : ``);
};
